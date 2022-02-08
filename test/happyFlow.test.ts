import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import {
  Aurei,
  ERC20AssetManager,
  VaultEngine,
  NativeAssetManager,
  Teller,
  Treasury,
  MockFtso,
  PriceFeed,
  Auctioneer,
  Liquidator,
  ReservePool,
  Registry,
  MockERC20AssetManager,
  BondIssuer,
} from "../typechain";
import { deployTest } from "../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { ASSET_ID, bytes32, WAD, RAY, RAD } from "./utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vaultEngine: VaultEngine;
let registry: Registry;
let flrWallet: NativeAssetManager;
let fxrpWallet: ERC20AssetManager;
let teller: Teller;
let treasury: Treasury;
let ftso: MockFtso;
let priceFeed: PriceFeed;
let auctioneer: Auctioneer;
let liquidator: Liquidator;
let reserve: ReservePool;
let erc20: MockERC20AssetManager;
let bondIssuer: BondIssuer;

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
    flrWallet = contracts.nativeAssetManager;
    fxrpWallet = contracts.erc20AssetManager;
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
    bondIssuer = contracts.bondIssuer;

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
    let balance0 = await ethers.provider.getBalance(owner.address);
    let [standby0] = await vaultEngine.vaults(ASSET_ID["FLR"], owner.address);

    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Balances after native token deposit
    let balance1 = await ethers.provider.getBalance(owner.address);
    let [standby1] = await vaultEngine.vaults(ASSET_ID["FLR"], owner.address);

    expect(balance0.sub(balance1) >= STANDBY_AMOUNT).to.equal(true);
    expect(standby1.sub(standby0)).to.equal(STANDBY_AMOUNT);

    // Balances before native token withdrawal
    let balance2 = await ethers.provider.getBalance(owner.address);
    let [standby2] = await vaultEngine.vaults(ASSET_ID["FLR"], owner.address);

    // Withdraw native token (FLR)
    await flrWallet.withdraw(WITHDRAW_AMOUNT);

    // Balances after native token withdrawal
    let balance3 = await ethers.provider.getBalance(owner.address);
    let [standby3] = await vaultEngine.vaults(ASSET_ID["FLR"], owner.address);

    expect(balance2.sub(balance3) < WITHDRAW_AMOUNT).to.equal(true);
    expect(standby2.sub(standby3)).to.equal(WITHDRAW_AMOUNT);
  });

  it("deposits and withdraws ERC20 token to/from wallet", async () => {
    const WITHDRAW_AMOUNT = STANDBY_AMOUNT.div(3); // 333 FXRP

    // Mint FXRP to user wallet
    await erc20.mint(owner.address, STANDBY_AMOUNT);
    await erc20.approve(fxrpWallet.address, STANDBY_AMOUNT);

    // Balances before ERC20 token deposit
    let balance0 = await erc20.balanceOf(owner.address);
    let [standby0] = await vaultEngine.vaults(ASSET_ID["FXRP"], owner.address);

    // Deposit ERC20 token (FXRP)
    await fxrpWallet.deposit(STANDBY_AMOUNT);

    // Balances after ERC20 token deposit
    let balance1 = await erc20.balanceOf(owner.address);
    let [standby1] = await vaultEngine.vaults(ASSET_ID["FXRP"], owner.address);

    expect(balance0.sub(balance1)).to.equal(STANDBY_AMOUNT);
    expect(standby1.sub(standby0)).to.equal(STANDBY_AMOUNT);

    // Balances before ERC20 token deposit
    let balance2 = await erc20.balanceOf(owner.address);
    let [standby2] = await vaultEngine.vaults(ASSET_ID["FXRP"], owner.address);

    // Withdraw ERC20 token (FXRP)
    await fxrpWallet.withdraw(WITHDRAW_AMOUNT);

    // Balances after ERC20 token deposit
    let balance3 = await erc20.balanceOf(owner.address);
    let [standby3] = await vaultEngine.vaults(ASSET_ID["FXRP"], owner.address);

    expect(balance3.sub(balance2)).to.equal(WITHDRAW_AMOUNT);
    expect(standby2.sub(standby3)).to.equal(WITHDRAW_AMOUNT);
  });

  it("increases equity, increases debt, and allows stablecoin withdrawal", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await priceFeed
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Get balance before minting
    let [, underlying0, , equity0] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );

    // Mint stablecoins
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    // Expect vault balances to be updated
    let [, underlying1, , , equity1] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    expect(underlying1.sub(underlying0)).to.equal(UNDERLYING_AMOUNT);
    expect(equity1.sub(equity0)).to.equal(EQUITY_AMOUNT);

    // Get balances before taking out a loan
    let [standby0, , collateral0, debt0] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    let stablecoin0 = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSET_ID["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    // Expect stablecoin and vault balances to be updated
    let stablecoin1 = await vaultEngine.stablecoin(owner.address);
    expect(stablecoin1.sub(stablecoin0)).to.equal(LOAN_AMOUNT.mul(RAY));
    let [standby1, , collateral1, debt1] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    expect(standby0.sub(standby1)).to.equal(COLL_AMOUNT);
    expect(collateral1.sub(collateral0)).to.equal(COLL_AMOUNT);
    expect(debt1.sub(debt0)).to.equal(LOAN_AMOUNT);

    // Withdraw stablecoins from vault to ERC20 tokens
    let balance0 = await aurei.balanceOf(owner.address);
    await treasury.withdrawStablecoin(stablecoin1.div(RAY));

    // Expect stablecoin balance to be updated
    let ownerBalanceAfter = await aurei.balanceOf(owner.address);
    expect(ownerBalanceAfter.sub(balance0).mul(RAY)).to.equal(stablecoin1);
  });

  it("allows debt repayment", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await priceFeed
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Increase equity
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    let [standby0, , , debt0] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    let stablecoin0 = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSET_ID["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let stablecoin1 = await vaultEngine.stablecoin(owner.address);
    expect(stablecoin1.sub(stablecoin0)).to.equal(LOAN_AMOUNT.mul(RAY));
    let [standby1, , , debt1] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    expect(standby0.sub(standby1)).to.equal(COLL_AMOUNT);
    expect(debt1.sub(debt0)).to.equal(LOAN_AMOUNT);

    let [standby2, , , debt2] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    let stablecoin2 = await vaultEngine.stablecoin(owner.address);

    // Repay loan
    await vaultEngine.modifyDebt(
      ASSET_ID["FLR"],
      treasury.address,
      LOAN_REPAY_COLL_AMOUNT,
      LOAN_REPAY_DEBT_AMOUNT
    );

    let stablecoin3 = await vaultEngine.stablecoin(owner.address);
    expect(stablecoin3.sub(stablecoin2)).to.equal(
      LOAN_REPAY_DEBT_AMOUNT.mul(RAY)
    );
    let [standby3, , , debt3] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );
    expect(standby2.sub(standby3)).to.equal(LOAN_REPAY_COLL_AMOUNT);
    expect(debt3.sub(debt2)).to.equal(LOAN_REPAY_DEBT_AMOUNT);
  });

  it("allows underlying asset redemption", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await priceFeed
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Get balances before increasing equity
    let [standby0, underlying0, , , equity0] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );

    // Increase equity
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT,
      EQUITY_AMOUNT
    );

    // Get balances after increasing equity
    let [standby1, underlying1, , , equity1] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );

    // Expect balances to be updated
    expect(standby0.sub(standby1)).to.equal(UNDERLYING_AMOUNT);
    expect(underlying1.sub(underlying0)).to.equal(UNDERLYING_AMOUNT);
    expect(equity1.sub(equity0)).to.equal(EQUITY_AMOUNT);

    // Redeem underlying assets
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT_TO_DECREASE,
      EQUITY_AMOUNT_TO_DECREASE
    );

    // Get balances after redemption
    let [standby2, underlying2, , , equity2] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );

    // Expect balances to be updated
    expect(standby1.sub(standby2)).to.equal(UNDERLYING_AMOUNT_TO_DECREASE);
    expect(underlying1.sub(underlying2)).to.equal(UNDERLYING_AMOUNT);
    expect(equity2.sub(equity1)).to.equal(EQUITY_AMOUNT_TO_DECREASE);
  });

  it("updates the price feed", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await priceFeed
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], WAD.mul(15).div(10), ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    let [, , adjustedPrice] = await vaultEngine.assets(ASSET_ID["FLR"]);
    let expectedPrice = RAY.div(3).mul(2);
    // As long as the expected price is within a buffer, call it success
    expect(adjustedPrice.sub(expectedPrice).toNumber() <= 10).to.equal(true);
  });

  it("liquidates unhealthy vaults", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT.mul(2) });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await liquidator
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], auctioneer.address);
    await priceFeed.connect(gov).initAsset(ASSET_ID["FLR"], WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Increase equity
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT.mul(2),
      EQUITY_AMOUNT
    );

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSET_ID["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    // Set liquidation ratio to 220%
    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(ASSET_ID["FLR"], WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Get unbacked debt and balances before liquidation
    let unbackedDebt0 = await vaultEngine.unbackedDebt(reserve.address);
    let [, underlying0] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );

    // Liquidate the vault
    await liquidator.liquidateVault(ASSET_ID["FLR"], owner.address);

    // Get unbacked debt and balances after liquidation
    let unbackedDebt1 = await vaultEngine.unbackedDebt(reserve.address);
    let [, underlying1] = await vaultEngine.vaults(
      ASSET_ID["FLR"],
      owner.address
    );

    // Expect unbacked debt to equal the loan amount and underlying to be the same (?)
    expect(unbackedDebt1.sub(unbackedDebt0)).to.equal(LOAN_AMOUNT.mul(RAY));
    expect(underlying1).to.equal(UNDERLYING_AMOUNT.mul(2));
  });

  it("creates an auction and allows a user to buy the collateral", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT.mul(2) });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await liquidator
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], auctioneer.address);
    await priceFeed.connect(gov).initAsset(ASSET_ID["FLR"], WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Increase equity
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT.mul(2),
      EQUITY_AMOUNT
    );

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSET_ID["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    // Set liquidation ratio to 220%
    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(ASSET_ID["FLR"], WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Liquidate the vault
    await liquidator.liquidateVault(ASSET_ID["FLR"], owner.address);

    // Deposit FLR as a secondary user
    await flrWallet.connect(user).deposit({ value: WAD.mul(50_000) });

    // Increase equity as user
    await vaultEngine
      .connect(user)
      .modifyEquity(
        ASSET_ID["FLR"],
        treasury.address,
        WAD.mul(20_000),
        WAD.mul(1000)
      );

    // Take out a loan as user
    await vaultEngine
      .connect(user)
      .modifyDebt(
        ASSET_ID["FLR"],
        treasury.address,
        WAD.mul(20000),
        WAD.mul(600)
      );

    // Place a bid on the collateral auction as user
    const auctionId = 0,
      price0 = RAY.mul(10).div(10),
      lot0 = WAD.mul("100");
    await auctioneer.connect(user).placeBid(auctionId, price0, lot0);
    let [price1, lot1] = await auctioneer.bids(auctionId, user.address);

    // Expect bid data to equal the inputs
    expect(price1).to.equal(price0);
    expect(lot1).to.equal(lot0);

    const BUY_PRICE = RAY.mul(12).div(10); // $1.20
    const EXPECTED_BUY_LOT = WAD.mul(10);
    const EXPECTED_BUY_VALUE = BUY_PRICE.mul(EXPECTED_BUY_LOT); // $12.00

    // Get standby and stablecoin balances before purchase
    let [standby0] = await vaultEngine.vaults(ASSET_ID["FLR"], user.address);
    let stablecoin0 = await vaultEngine.stablecoin(user.address);

    // Purchase 10 FLR on auction for $1.20 per unit
    await auctioneer
      .connect(user)
      .buyItNow(auctionId, BUY_PRICE, EXPECTED_BUY_LOT);

    // Get standby and stablecoin balances after purchase
    let [standby1] = await vaultEngine.vaults(ASSET_ID["FLR"], user.address);
    let stablecoin1 = await vaultEngine.stablecoin(user.address);

    // Expect (?)
    expect(
      stablecoin0.sub(stablecoin1).sub(EXPECTED_BUY_VALUE).abs().lte(RAD)
    ).to.equal(true);
    expect(
      standby1.sub(standby0).sub(EXPECTED_BUY_LOT).toNumber() <= 1e17
    ).to.equal(true);
  });

  it("runs an IOU sale", async () => {
    // Deposit native token (FLR)
    await flrWallet.deposit({ value: STANDBY_AMOUNT.mul(2) });

    // Initialize the FLR asset
    await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
    await vaultEngine
      .connect(gov)
      .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
    await teller.connect(gov).initAsset(ASSET_ID["FLR"], 0);
    await liquidator
      .connect(gov)
      .initAsset(ASSET_ID["FLR"], auctioneer.address);
    await priceFeed.connect(gov).initAsset(ASSET_ID["FLR"], WAD, ftso.address);
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Increase equity
    await vaultEngine.modifyEquity(
      ASSET_ID["FLR"],
      treasury.address,
      UNDERLYING_AMOUNT.mul(2),
      EQUITY_AMOUNT
    );

    // Take out a loan
    await vaultEngine.modifyDebt(
      ASSET_ID["FLR"],
      treasury.address,
      COLL_AMOUNT,
      LOAN_AMOUNT
    );

    // Set liquidation ratio to 220%
    await priceFeed
      .connect(gov)
      .updateLiquidationRatio(ASSET_ID["FLR"], WAD.mul(22).div(10));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FLR"]);

    // Liquidate the vault
    await liquidator.liquidateVault(ASSET_ID["FLR"], owner.address);

    // Check the amount on auction (lot = 200 FLR, debt = 100 AUR + 17 AUR penalty)
    let auction = await auctioneer.auctions(0);
    const penalty = WAD.mul(17);
    expect(auction.lot).to.equal(COLL_AMOUNT);
    expect(auction.debt).to.equal(LOAN_AMOUNT.add(penalty).mul(RAY));

    // Deposit FLR as a secondary user
    await flrWallet.connect(user).deposit({ value: WAD.mul(300_000) });

    // Increase equity as user
    await vaultEngine
      .connect(user)
      .modifyEquity(
        ASSET_ID["FLR"],
        treasury.address,
        WAD.mul(20_000),
        WAD.mul(1000)
      );

    // Take out a loan as user
    await vaultEngine
      .connect(user)
      .modifyDebt(
        ASSET_ID["FLR"],
        treasury.address,
        WAD.mul(9000),
        WAD.mul(600)
      );

    // Expect unbacked debt to equal amount on auction (100)
    const unbackedDebt = await vaultEngine.unbackedDebt(reserve.address);
    expect(unbackedDebt).to.equal(LOAN_AMOUNT.mul(RAY));

    // Reduce auction debt by 20 AUR (from 100 to 80)
    const debtToReduce = RAD.mul(20);
    await liquidator.reduceAuctionDebt(debtToReduce);

    // Expect debt to be reduced
    const debtOnAuction = await reserve.debtOnAuction();
    expect(debtOnAuction).to.equal(LOAN_AMOUNT.mul(RAY).sub(debtToReduce));

    // Set debt threshold to 10 AUR
    const debtThreshold = RAD.mul(10);
    await reserve.connect(gov).updateDebtThreshold(debtThreshold);

    // Expect debt threshold to be reduced
    const _debtThreshold = await reserve.debtThreshold();
    expect(_debtThreshold).to.equal(debtThreshold);

    // Start an IOU sale (unbackedDebt - debtOnAuction > debtThreshold)
    await reserve.connect(gov).startSale();

    await ethers.provider.send("evm_increaseTime", [21601]);
    await ethers.provider.send("evm_mine", []);

    // Purchase 10 vouchers
    await bondIssuer.connect(user).purchaseVouchers(RAD.mul(10));

    // Get the amount of vouchers
    let vouchers = await bondIssuer.vouchers(user.address);

    // Expect more than 10 vouchers (?)
    expect(vouchers > RAD.mul(10)).to.equal(true);
  });
});
