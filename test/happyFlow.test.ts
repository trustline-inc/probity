import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

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
import { ethers } from "hardhat";
import * as chai from "chai";
import { ASSETS, bytes32, WAD, RAY, RAD } from "./utils/constants";
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

const STANDBY_AMOUNT = WAD.mul(1000);
const UNDERLYING_AMOUNT = WAD.mul(400);
const UNDERLYING_AMOUNT_TO_DECREASE = WAD.mul(-400);
const EQUITY_AMOUNT_TO_DECREASE = WAD.mul(-200);
const EQUITY_AMOUNT = WAD.mul(200);
const COLL_AMOUNT = WAD.mul(200);
const LOAN_AMOUNT = WAD.mul(100);
const LOAN_REPAY_COLL_AMOUNT = WAD.mul(-200);
const LOAN_REPAY_DEBT_AMOUNT = WAD.mul(-100);

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
    const WITHDRAW_AMOUNT = STANDBY_AMOUNT.div(3); // 333 FLR

    // Balances before native token deposit
    let accountBalanceBeforeDeposit = await ethers.provider.getBalance(
      owner.address
    );
    let vaultBalanceBeforeDeposit = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );

    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Balances after native token deposit
    let accountBalanceAfterDeposit = await ethers.provider.getBalance(
      owner.address
    );
    let vaultBalanceAfterDeposit = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );

    expect(
      accountBalanceBeforeDeposit.sub(accountBalanceAfterDeposit) >=
        STANDBY_AMOUNT
    ).to.equal(true);
    expect(
      vaultBalanceAfterDeposit[0].sub(vaultBalanceBeforeDeposit[0])
    ).to.equal(STANDBY_AMOUNT);

    // Balances before native token withdrawal
    let accountBalanceBeforeWithdrawal = await ethers.provider.getBalance(
      owner.address
    );
    let vaultBalanceBeforeWithdrawal = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );

    // Withdraw native token (FLR)
    await flrWallet.withdraw(WITHDRAW_AMOUNT);

    // Balances after native token withdrawal
    let accountBalanceAfterWithdrawal = await ethers.provider.getBalance(
      owner.address
    );
    let vaultBalanceAfterWithdrawal = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );

    expect(
      accountBalanceBeforeWithdrawal.sub(accountBalanceAfterWithdrawal) <
        WITHDRAW_AMOUNT
    ).to.equal(true);
    expect(
      vaultBalanceBeforeWithdrawal[0].sub(vaultBalanceAfterWithdrawal[0])
    ).to.equal(WITHDRAW_AMOUNT);
  });

  it("deposits and withdraws ERC20 token to/from wallet", async () => {
    const WITHDRAW_AMOUNT = STANDBY_AMOUNT.div(3); // 333 FXRP

    // Mint FXRP to user wallet
    await erc20.mint(owner.address, STANDBY_AMOUNT);
    await erc20.approve(fxrpWallet.address, STANDBY_AMOUNT);

    // Balances before ERC20 token deposit
    let accountBalanceBeforeDeposit = await erc20.balanceOf(owner.address);
    let vaultBalanceBeforeDeposit = await vaultEngine.vaults(
      ASSETS["FXRP"],
      owner.address
    );

    // Deposit ERC20 token (FXRP)
    await fxrpWallet.deposit(STANDBY_AMOUNT);

    // Balances after ERC20 token deposit
    let accountBalanceAfterDeposit = await erc20.balanceOf(owner.address);
    let vaultBalanceAfterDeposit = await vaultEngine.vaults(
      ASSETS["FXRP"],
      owner.address
    );

    expect(
      accountBalanceBeforeDeposit.sub(accountBalanceAfterDeposit)
    ).to.equal(STANDBY_AMOUNT);
    expect(
      vaultBalanceAfterDeposit[0].sub(vaultBalanceBeforeDeposit[0])
    ).to.equal(STANDBY_AMOUNT);

    // Balances before ERC20 token deposit
    let accountBalanceBeforeWithdrawal = await erc20.balanceOf(owner.address);
    let vaultBalanceBeforeWithdrawal = await vaultEngine.vaults(
      ASSETS["FXRP"],
      owner.address
    );

    // Withdraw ERC20 token (FXRP)
    await fxrpWallet.withdraw(WITHDRAW_AMOUNT);

    // Balances after ERC20 token deposit
    let accountBalanceAfterWithdrawal = await erc20.balanceOf(owner.address);
    let vaultBalanceAfterWithdrawal = await vaultEngine.vaults(
      ASSETS["FXRP"],
      owner.address
    );

    expect(
      accountBalanceAfterWithdrawal.sub(accountBalanceBeforeWithdrawal)
    ).to.equal(WITHDRAW_AMOUNT);
    expect(
      vaultBalanceBeforeWithdrawal[0].sub(vaultBalanceAfterWithdrawal[0])
    ).to.equal(WITHDRAW_AMOUNT);
  });

  it("increases equity, increases debt, and allows stablecoin withdrawal", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await priceFeed
      .connect(gov)
      .init(ASSETS["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    // Get balance before minting
    let userVaultBefore = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );

    // Mint stablecoins
    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    // Expect vault balances to be updated
    let userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      UNDERLYING_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(EQUITY_AMOUNT);

    // Get balances before taking out a loan
    userVaultBefore = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    let stablecoinBefore = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSETS["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    // Expect stablecoin and vault balances to be updated
    let stablecoinAfter = await vaultEngine.stablecoin(owner.address);
    expect(stablecoinAfter.sub(stablecoinBefore)).to.equal(
      LOAN_AMOUNT.mul(RAY)
    );
    userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(COLL_AMOUNT);
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);

    // Withdraw stablecoins from vault to ERC20 tokens
    let ownerBalanceBefore = await aurei.balanceOf(owner.address);
    await treasury.withdrawStablecoin(stablecoinAfter.div(RAY));

    // Expect stablecoin balance to be updated
    let ownerBalanceAfter = await aurei.balanceOf(owner.address);
    expect(ownerBalanceAfter.sub(ownerBalanceBefore).mul(RAY)).to.equal(
      stablecoinAfter
    );
  });

  it("allows debt repayment", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10000000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await priceFeed
      .connect(gov)
      .init(ASSETS["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    // Create stablecoin
    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    let userVaultBefore = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );
    let stablecoinBefore = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSETS["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let stablecoinAfter = await vaultEngine.stablecoin(owner.address);
    expect(stablecoinAfter.sub(stablecoinBefore)).to.equal(
      LOAN_AMOUNT.mul(RAY)
    );
    let userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(COLL_AMOUNT);
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);

    userVaultBefore = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    stablecoinBefore = await vaultEngine.stablecoin(owner.address);

    // Repay loan
    await vaultEngine.modifyDebt(
      ASSETS["FLR"],
      treasury.address,
      LOAN_REPAY_COLL_AMOUNT,
      LOAN_REPAY_DEBT_AMOUNT
    );

    stablecoinAfter = await vaultEngine.stablecoin(owner.address);
    expect(stablecoinAfter.sub(stablecoinBefore)).to.equal(
      LOAN_REPAY_DEBT_AMOUNT.mul(RAY)
    );
    userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      LOAN_REPAY_COLL_AMOUNT
    );
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(
      LOAN_REPAY_DEBT_AMOUNT
    );
  });

  it("allows underlying asset redemption", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10000000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await priceFeed
      .connect(gov)
      .init(ASSETS["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    let userVaultBefore = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );

    // Create stablecoin
    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    let userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      UNDERLYING_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(EQUITY_AMOUNT);

    // Redeem underlying assets
    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT_TO_DECREASE,
      EQUITY_AMOUNT_TO_DECREASE
    );

    let userVaultAfterDecrease = await vaultEngine.vaults(
      ASSETS["FLR"],
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
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10000000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await priceFeed
      .connect(gov)
      .init(ASSETS["FLR"], WAD.mul(15).div(10), ftso.address);

    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    let assetAfter = await vaultEngine.assets(ASSETS["FLR"]);
    let expectedPrice = RAY.div(3).mul(2);
    // As long as the expectedPrice is within a buffer, call it success
    expect(assetAfter[2].sub(expectedPrice).toNumber() <= 10).to.equal(true);
  });

  it("liquidates unhealthy vaults", async () => {
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10000000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await liquidator.connect(gov).init(ASSETS["FLR"], auctioneer.address);
    await priceFeed.connect(gov).init(ASSETS["FLR"], WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      ASSETS["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(ASSETS["FLR"], WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);
    let unBackedAurBefore = await vaultEngine.unbackedDebt(reserve.address);
    let userVaultBefore = await vaultEngine.vaults(
      ASSETS["FLR"],
      owner.address
    );
    await liquidator.liquidateVault(ASSETS["FLR"], owner.address);
    let unBackedAurAfter = await vaultEngine.unbackedDebt(reserve.address);
    let userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], owner.address);
    expect(unBackedAurAfter.sub(unBackedAurBefore)).to.equal(
      EQUITY_AMOUNT.add(LOAN_AMOUNT).mul(RAY)
    );
    expect(userVaultBefore[1].sub(userVaultAfter[1])).to.equal(
      UNDERLYING_AMOUNT.add(COLL_AMOUNT)
    );
  });

  it("creates an auction and allows a user to buy the collateral", async () => {
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10000000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await liquidator.connect(gov).init(ASSETS["FLR"], auctioneer.address);
    await priceFeed.connect(gov).init(ASSETS["FLR"], WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      ASSETS["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(ASSETS["FLR"], WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    await liquidator.liquidateVault(ASSETS["FLR"], owner.address);

    const flrWalletUser = flrWallet.connect(user);
    const vaultUser = vaultEngine.connect(user);
    const auctioneerUser = auctioneer.connect(user);
    await flrWalletUser.deposit({ value: WAD.mul(30000) });
    await vaultUser.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      WAD.mul(20000),
      WAD.mul(1000)
    );
    await vaultUser.modifyDebt(
      ASSETS["FLR"],
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

    let userVaultBefore = await vaultEngine.vaults(ASSETS["FLR"], user.address);
    let userAurBefore = await vaultEngine.stablecoin(user.address);
    await auctioneerUser.buyItNow(0, BUY_PRICE, EXPECTED_BUY_LOT);
    let userVaultAfter = await vaultEngine.vaults(ASSETS["FLR"], user.address);
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
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    await vaultEngine.connect(gov).initAssetType(ASSETS["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSETS["FLR"], RAD.mul(10000000));
    await teller.connect(gov).initCollType(ASSETS["FLR"], 0);
    await liquidator.connect(gov).init(ASSETS["FLR"], auctioneer.address);
    await priceFeed.connect(gov).init(ASSETS["FLR"], WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    await vaultEngine.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      ASSETS["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(ASSETS["FLR"], WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    await liquidator.liquidateVault(ASSETS["FLR"], owner.address);

    const flrWalletUser = flrWallet.connect(user);
    const vaultUser = vaultEngine.connect(user);
    await flrWalletUser.deposit({ value: WAD.mul(30000) });
    await vaultUser.modifyEquity(
      ASSETS["FLR"],
      treasury.address,
      WAD.mul(20000),
      WAD.mul(1000)
    );

    await vaultUser.modifyDebt(
      ASSETS["FLR"],
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
