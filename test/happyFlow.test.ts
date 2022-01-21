import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import * as hre from "hardhat";

import {
  Aurei,
  ERC20Token,
  VaultEngine,
  NativeToken,
  Teller,
  Treasury,
  MockFtso,
  PriceFeed,
  Auctioneer,
  Liquidator,
  ReservePool,
  Registry,
  MockERC20Token,
} from "../typechain";
import { deployTest } from "../lib/deployer";
import { ethers, web3 } from "hardhat";
import * as chai from "chai";
import { bytes32 } from "./utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vaultEngine: VaultEngine;
let registry: Registry;
let flrWallet: NativeToken;
let fxrpWallet: ERC20Token;
let teller: Teller;
let treasury: Treasury;
let ftso: MockFtso;
let priceFeed: PriceFeed;
let auctioneer: Auctioneer;
let liquidator: Liquidator;
let reserve: ReservePool;
let erc20: MockERC20Token;

const WAD = ethers.BigNumber.from("1000000000000000000");
const RAY = ethers.BigNumber.from("1000000000000000000000000000");
const RAD = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

const ASSET_AMOUNT = WAD.mul(1000);
const UNDERLYING_AMOUNT = WAD.mul(400);
const UNDERLYING_AMOUNT_TO_DECREASE = WAD.mul(-400);
const EQUITY_AMOUNT_TO_DECREASE = WAD.mul(-200);
const EQUITY_AMOUNT = WAD.mul(200);
const COLL_AMOUNT = WAD.mul(200);
const LOAN_AMOUNT = WAD.mul(100);
const LOAN_REPAY_COLL_AMOUNT = WAD.mul(-200);
const LOAN_REPAY_AMOUNT = WAD.mul(-100);

const flrAssetId = web3.utils.keccak256("FLR");
const fxrpAssetId = web3.utils.keccak256("FXRP");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Probity happy flow", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest("AUR");

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    flrWallet = contracts.nativeToken;
    fxrpWallet = contracts.erc20Token;
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    ftso = contracts.ftso;
    priceFeed = contracts.priceFeed;
    auctioneer = contracts.auctioneer;
    liquidator = contracts.liquidator;
    reserve = contracts.reservePool;
    registry = contracts.registry;
    erc20 = contracts.mockErc20Token;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;

    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry.setupAddress(bytes32("whitelisted"), user.address);
    await registry.setupAddress(bytes32("whitelisted"), owner.address);
  });

  it("deposits and withdraws native token to/from wallet", async () => {
    const WITHDRAW_AMOUNT = ASSET_AMOUNT.div(3);

    // Deposit native token (FLR)
    let flrBalBefore = await ethers.provider.getBalance(owner.address);
    let vaultFlrBalBefore = await vaultEngine.vaults(flrAssetId, owner.address);

    await flrWallet.deposit({ value: ASSET_AMOUNT });

    let flrBalAfter = await ethers.provider.getBalance(owner.address);
    let vaultFlrBalAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(flrBalBefore.sub(flrBalAfter) >= ASSET_AMOUNT).to.equal(true);
    expect(vaultFlrBalAfter[0].sub(vaultFlrBalBefore[0])).to.equal(
      ASSET_AMOUNT
    );

    // Withdraw native token (FLR)
    flrBalBefore = await ethers.provider.getBalance(owner.address);
    vaultFlrBalBefore = await vaultEngine.vaults(flrAssetId, owner.address);

    await flrWallet.withdraw(WITHDRAW_AMOUNT);

    flrBalAfter = await ethers.provider.getBalance(owner.address);
    vaultFlrBalAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(flrBalBefore.sub(flrBalAfter) < WITHDRAW_AMOUNT).to.equal(true);
    expect(vaultFlrBalBefore[0].sub(vaultFlrBalAfter[0])).to.equal(
      WITHDRAW_AMOUNT
    );

    // Deposit ERC20 token (FXRP)
    await erc20.mint(owner.address, ASSET_AMOUNT);
    await erc20.approve(fxrpWallet.address, ASSET_AMOUNT);

    let fxrpBalBefore = await erc20.balanceOf(owner.address);
    let vaultFxrpBalBefore = await vaultEngine.vaults(
      fxrpAssetId,
      owner.address
    );

    await fxrpWallet.deposit(ASSET_AMOUNT);

    let vaultFxrpBalAfter = await vaultEngine.vaults(
      fxrpAssetId,
      owner.address
    );
    let fxrpBalAfter = await erc20.balanceOf(owner.address);

    expect(fxrpBalBefore.sub(fxrpBalAfter)).to.equal(ASSET_AMOUNT);
    expect(vaultFxrpBalAfter[0].sub(vaultFxrpBalBefore[0])).to.equal(
      ASSET_AMOUNT
    );

    // Withdraw FXRP collateral
    fxrpBalBefore = await erc20.balanceOf(owner.address);
    vaultFxrpBalBefore = await vaultEngine.vaults(fxrpAssetId, owner.address);

    await fxrpWallet.withdraw(WITHDRAW_AMOUNT);

    vaultFxrpBalAfter = await vaultEngine.vaults(fxrpAssetId, owner.address);
    fxrpBalAfter = await erc20.balanceOf(owner.address);

    expect(fxrpBalAfter.sub(fxrpBalBefore)).to.equal(WITHDRAW_AMOUNT);
    expect(vaultFxrpBalBefore[0].sub(vaultFxrpBalAfter[0])).to.equal(
      WITHDRAW_AMOUNT
    );
  });

  it("increases equity & debt and allows stablecoin withdrawal", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await priceFeed
      .connect(gov)
      .init(flrAssetId, WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(flrAssetId);

    let userVaultBefore = await vaultEngine.vaults(flrAssetId, owner.address);

    // Create stablecoin
    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    let userVaultAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      UNDERLYING_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(EQUITY_AMOUNT);

    userVaultBefore = await vaultEngine.vaults(flrAssetId, owner.address);
    let aurBefore = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      flrAssetId,
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let aurAfter = await vaultEngine.stablecoin(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(LOAN_AMOUNT.mul(RAY));
    userVaultAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(COLL_AMOUNT);
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);

    // Stablecoin withdrawal
    let ownerBalanceBefore = await aurei.balanceOf(owner.address);
    await treasury.withdrawStablecoin(aurAfter.div(RAY));
    let ownerBalanceAfter = await aurei.balanceOf(owner.address);
    expect(ownerBalanceAfter.sub(ownerBalanceBefore).mul(RAY)).to.equal(
      aurAfter
    );
  });

  it("allows debt repayment", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await priceFeed
      .connect(gov)
      .init(flrAssetId, WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(flrAssetId);

    // Create stablecoin
    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    let userVaultBefore = await vaultEngine.vaults(flrAssetId, owner.address);
    let aurBefore = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      flrAssetId,
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let aurAfter = await vaultEngine.stablecoin(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(LOAN_AMOUNT.mul(RAY));
    let userVaultAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(COLL_AMOUNT);
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);

    userVaultBefore = await vaultEngine.vaults(flrAssetId, owner.address);
    aurBefore = await vaultEngine.stablecoin(owner.address);

    // Repay loan
    await vaultEngine.modifyDebt(
      flrAssetId,
      treasury.address,
      LOAN_REPAY_COLL_AMOUNT,
      LOAN_REPAY_AMOUNT
    );

    aurAfter = await vaultEngine.stablecoin(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(LOAN_REPAY_AMOUNT.mul(RAY));
    userVaultAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      LOAN_REPAY_COLL_AMOUNT
    );
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(
      LOAN_REPAY_AMOUNT
    );
  });

  it("allows underlying asset redemption", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await priceFeed
      .connect(gov)
      .init(flrAssetId, WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(flrAssetId);

    let userVaultBefore = await vaultEngine.vaults(flrAssetId, owner.address);

    // Create stablecoin
    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    let userVaultAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      UNDERLYING_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(EQUITY_AMOUNT);

    // Redeem underlying assets
    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT_TO_DECREASE,
      EQUITY_AMOUNT_TO_DECREASE
    );

    let userVaultAfterDecrease = await vaultEngine.vaults(
      flrAssetId,
      owner.address
    );
    expect(userVaultAfter[0].sub(userVaultAfterDecrease[0])).to.equal(
      UNDERLYING_AMOUNT_TO_DECREASE
    );
    expect(userVaultAfterDecrease[3].sub(userVaultAfter[3])).to.equal(
      EQUITY_AMOUNT_TO_DECREASE
    );
  });

  it("updates the price feed", async () => {
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await priceFeed
      .connect(gov)
      .init(flrAssetId, WAD.mul(15).div(10), ftso.address);

    await priceFeed.updateAdjustedPrice(flrAssetId);

    let assetAfter = await vaultEngine.assets(flrAssetId);
    let expectedPrice = RAY.div(3).mul(2);
    // As long as the expectedPrice is within a buffer, call it success
    expect(assetAfter[2].sub(expectedPrice).toNumber() <= 10).to.equal(true);
  });

  it("liquidates unhealthy vaults", async () => {
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await liquidator.connect(gov).init(flrAssetId, auctioneer.address);
    await priceFeed.connect(gov).init(flrAssetId, WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(flrAssetId);

    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      flrAssetId,
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(flrAssetId, WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(flrAssetId);
    let unBackedAurBefore = await vaultEngine.unbackedDebt(reserve.address);
    let userVaultBefore = await vaultEngine.vaults(flrAssetId, owner.address);
    await liquidator.liquidateVault(flrAssetId, owner.address);
    let unBackedAurAfter = await vaultEngine.unbackedDebt(reserve.address);
    let userVaultAfter = await vaultEngine.vaults(flrAssetId, owner.address);
    expect(unBackedAurAfter.sub(unBackedAurBefore)).to.equal(
      EQUITY_AMOUNT.add(LOAN_AMOUNT).mul(RAY)
    );
    expect(userVaultBefore[1].sub(userVaultAfter[1])).to.equal(
      UNDERLYING_AMOUNT.add(COLL_AMOUNT)
    );
  });

  it("creates an auction and allows a user to buy the collateral", async () => {
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await liquidator.connect(gov).init(flrAssetId, auctioneer.address);
    await priceFeed.connect(gov).init(flrAssetId, WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(flrAssetId);

    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      flrAssetId,
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(flrAssetId, WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(flrAssetId);

    await liquidator.liquidateVault(flrAssetId, owner.address);

    const flrWalletUser = flrWallet.connect(user);
    const vaultUser = vaultEngine.connect(user);
    const auctioneerUser = auctioneer.connect(user);
    await flrWalletUser.deposit({ value: WAD.mul(30000) });
    await vaultUser.modifyEquity(
      flrAssetId,
      treasury.address,
      WAD.mul(20000),
      WAD.mul(1000)
    );
    await vaultUser.modifyDebt(
      flrAssetId,
      treasury.address,
      WAD.mul(900),
      WAD.mul(600)
    );

    await auctioneerUser.placeBid(0, RAY.mul(10).div(10), WAD.mul("100"));
    let bidAfter = await auctioneer.bids(0, user.address);
    expect(bidAfter[0]).to.equal(RAY.mul(10).div(10));
    expect(bidAfter[1]).to.equal(WAD.mul("100"));

    const BUY_PRICE = RAY.mul(12).div(10);
    const EXPECTED_BUY_LOT = WAD.mul(10);
    const EXPECTED_BUY_VALUE = BUY_PRICE.mul(EXPECTED_BUY_LOT);

    let userVaultBefore = await vaultEngine.vaults(flrAssetId, user.address);
    let userAurBefore = await vaultEngine.stablecoin(user.address);
    await auctioneerUser.buyItNow(0, BUY_PRICE, EXPECTED_BUY_LOT);
    let userVaultAfter = await vaultEngine.vaults(flrAssetId, user.address);
    let userAurAfter = await vaultEngine.stablecoin(user.address);
    expect(
      userAurBefore.sub(userAurAfter).sub(EXPECTED_BUY_VALUE).abs().lte(RAD)
    ).to.equal(true);
    expect(
      userVaultAfter[0]
        .sub(userVaultBefore[0])
        .sub(EXPECTED_BUY_LOT)
        .toNumber() <= 1e17
    ).to.equal(true);
  });

  it("runs an IOU sale", async () => {
    await flrWallet.deposit({ value: ASSET_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(flrAssetId);
    await vaultEngine.connect(gov).updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.connect(gov).initCollType(flrAssetId, 0);
    await liquidator.connect(gov).init(flrAssetId, auctioneer.address);
    await priceFeed.connect(gov).init(flrAssetId, WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(flrAssetId);

    await vaultEngine.modifyEquity(
      flrAssetId,
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      flrAssetId,
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(flrAssetId, WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(flrAssetId);

    await liquidator.liquidateVault(flrAssetId, owner.address);

    const flrWalletUser = flrWallet.connect(user);
    const vaultUser = vaultEngine.connect(user);
    await flrWalletUser.deposit({ value: WAD.mul(30000) });
    await vaultUser.modifyEquity(
      flrAssetId,
      treasury.address,
      WAD.mul(20000),
      WAD.mul(1000)
    );

    await vaultUser.modifyDebt(
      flrAssetId,
      treasury.address,
      WAD.mul(900),
      WAD.mul(600)
    );

    await liquidator.reduceAuctionDebt(RAD.mul(201));
    await reserve.connect(gov).updateDebtThreshold(RAD.mul(200));
    await reserve.startSale();

    const reserveUser = reserve.connect(user);
    await ethers.provider.send("evm_increaseTime", [21601]);
    await ethers.provider.send("evm_mine", []);
    await reserveUser.purchaseVouchers(RAD.mul(100));

    let userIOU = await reserve.vouchers(user.address);
    expect(userIOU > RAD.mul(100)).to.equal(true);
  });
});
