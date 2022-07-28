import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  USD,
  Liquidator,
  MockAuctioneer,
  MockBondIssuer,
  MockLiquidator,
  MockPriceFeed,
  MockReservePool,
  MockVaultEngine,
  PriceFeed,
  Registry,
  Shutdown,
  Teller,
  Treasury,
  VaultEngine,
} from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";

import {
  ADDRESS_ZERO,
  ASSET_ID,
  bytes32,
  BYTES32_ZERO,
  RAD,
  WAD,
  RAY,
} from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
import { rmul, rdiv, rpow, wdiv } from "../utils/math";
import { BigNumber } from "ethers";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let teller: Teller;
let vaultEngine: MockVaultEngine;
let registry: Registry;
let shutdown: Shutdown;
let priceFeed: MockPriceFeed;
let treasury: Treasury;
let liquidator: MockLiquidator;
let auctioneer: MockAuctioneer;
let reservePool: MockReservePool;
let bondIssuer: MockBondIssuer;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Shutdown Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;
    vaultEngine = contracts.mockVaultEngine!;
    teller = contracts.teller!;
    priceFeed = contracts.mockPriceFeed!;
    treasury = contracts.treasury!;
    liquidator = contracts.mockLiquidator!;
    reservePool = contracts.mockReserve!;
    auctioneer = contracts.mockAuctioneer!;
    bondIssuer = contracts.mockBondIssuer!;

    contracts = await probity.deployShutdown({
      vaultEngine: vaultEngine.address,
      priceFeed: priceFeed.address,
      liquidator: liquidator.address,
      reservePool: reservePool.address,
      bondIssuer: bondIssuer.address,
    });

    shutdown = contracts.shutdown!;

    owner = signers.owner!;
    user = signers.alice!;
    await liquidator.setAssetType(ASSET_ID.FLR, auctioneer.address);
  });

  describe("switchAddress Unit Tests", function () {
    it("should switch the PriceFeed address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.priceFeed();
      expect(before).to.equal(priceFeed.address);
      await shutdown.switchAddress(bytes32("PriceFeed"), NEW_ADDRESS);
      const after = await shutdown.priceFeed();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should switch the VaultEngine address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.vaultEngine();
      expect(before).to.equal(vaultEngine.address);
      await shutdown.switchAddress(bytes32("VaultEngine"), NEW_ADDRESS);
      const after = await shutdown.vaultEngine();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should switch the ReservePool address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.reservePool();
      expect(before).to.equal(reservePool.address);
      await shutdown.switchAddress(bytes32("ReservePool"), NEW_ADDRESS);
      const after = await shutdown.reservePool();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should switch the Teller address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.teller();
      expect(before).to.equal(teller.address);
      await shutdown.switchAddress(bytes32("Teller"), NEW_ADDRESS);
      const after = await shutdown.teller();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should switch the Treasury address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.treasury();
      expect(before).to.equal(treasury.address);
      await shutdown.switchAddress(bytes32("Treasury"), NEW_ADDRESS);
      const after = await shutdown.treasury();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should switch the Liquidator address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.liquidator();
      expect(before).to.equal(liquidator.address);
      await shutdown.switchAddress(bytes32("Liquidator"), NEW_ADDRESS);
      const after = await shutdown.liquidator();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should switch the bondIssuer address", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.bondIssuer();
      expect(before).to.equal(bondIssuer.address);
      await shutdown.switchAddress(bytes32("bondIssuer"), NEW_ADDRESS);
      const after = await shutdown.bondIssuer();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("should fail if which is unknown", async () => {
      await assertRevert(
        shutdown.switchAddress(bytes32("unknown"), user.address),
        "shutdown/switchAddress: unknown which"
      );
      await shutdown.switchAddress(bytes32("VaultEngine"), user.address);
    });

    it("should fail if shutdown is set", async () => {
      await shutdown.switchAddress(bytes32("PriceFeed"), priceFeed.address);
      await shutdown.initiateShutdown();
      await assertRevert(
        shutdown.switchAddress(bytes32("PriceFeed"), user.address),
        "Shutdown/onlyWhenNotInShutdown: Shutdown has already been initiated"
      );
    });

    it("should fail if not from gov", async () => {
      await assertRevert(
        shutdown
          .connect(user)
          .switchAddress(bytes32("PriceFeed"), user.address),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await shutdown
        .connect(user)
        .switchAddress(bytes32("PriceFeed"), user.address);
    });
  });

  describe("changeWaitPeriod Unit Tests", function () {
    it("tests auctionWaitPeriod switch", async () => {
      const DEFAULT_VALUE = 172800;
      const NEW_ADDRESS = 172800 / 2;

      const before = await shutdown.auctionWaitPeriod();
      expect(before).to.equal(DEFAULT_VALUE);
      await shutdown.changeWaitPeriod(
        bytes32("auctionWaitPeriod"),
        NEW_ADDRESS
      );
      const after = await shutdown.auctionWaitPeriod();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("tests supplierWaitPeriod switch", async () => {
      const DEFAULT_VALUE = 172800;
      const NEW_ADDRESS = 172800 / 2;

      const before = await shutdown.supplierWaitPeriod();
      expect(before).to.equal(DEFAULT_VALUE);
      await shutdown.changeWaitPeriod(
        bytes32("supplierWaitPeriod"),
        NEW_ADDRESS
      );
      const after = await shutdown.supplierWaitPeriod();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("fail if which is unknown", async () => {
      const NEW_WAIT_PERIOD = 86400;

      await assertRevert(
        shutdown.changeWaitPeriod(bytes32("unknown"), NEW_WAIT_PERIOD),
        "shutdown/changeWaitPeriod: unknown which"
      );
      await shutdown.changeWaitPeriod(
        bytes32("auctionWaitPeriod"),
        NEW_WAIT_PERIOD
      );
    });

    it("fail if not from gov", async () => {
      const NEW_WAIT_PERIOD = 86400;

      await assertRevert(
        shutdown
          .connect(user)
          .changeWaitPeriod(bytes32("auctionWaitPeriod"), NEW_WAIT_PERIOD),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await shutdown
        .connect(user)
        .changeWaitPeriod(bytes32("auctionWaitPeriod"), NEW_WAIT_PERIOD);
    });
  });

  describe("initiateShutdown Unit Tests", function () {
    it("tests all relevant contracts have been paused", async () => {
      let shutdownStatus;
      shutdownStatus = await vaultEngine.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(false);
      shutdownStatus = await priceFeed.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(false);
      shutdownStatus = await teller.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(false);
      shutdownStatus = await treasury.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(false);
      shutdownStatus = await reservePool.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(false);
      shutdownStatus = await liquidator.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(false);

      await shutdown.initiateShutdown();
      shutdownStatus = await vaultEngine.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(true);
      shutdownStatus = await priceFeed.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(true);
      shutdownStatus = await teller.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(true);
      shutdownStatus = await treasury.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(true);
      shutdownStatus = await reservePool.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(true);
      shutdownStatus = await liquidator.states(bytes32("shutdown"));
      expect(shutdownStatus).to.equal(true);
    });

    it("tests values are properly set", async () => {
      const EQUITY_TO_SET = RAD.mul(1000);
      const DEBT_TO_SET = RAD.mul(342);
      const EXPECTED_UTIL_RATIO = wdiv(DEBT_TO_SET, EQUITY_TO_SET);

      let initiated = await shutdown.initiated();
      expect(initiated).to.equal(false);
      let initiatedAt = await shutdown.initiatedAt();
      expect(initiatedAt).to.equal(0);
      let utilRatio = await shutdown.finalUtilizationRatio();
      expect(utilRatio).to.equal(0);

      await vaultEngine.setLendingPoolEquity(EQUITY_TO_SET);
      await vaultEngine.setLendingPoolDebt(DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(DEBT_TO_SET);

      await shutdown.initiateShutdown();

      initiated = await shutdown.initiated();
      expect(initiated).to.equal(true);
      initiatedAt = await shutdown.initiatedAt();
      expect(initiatedAt).to.not.equal(0);
      utilRatio = await shutdown.finalUtilizationRatio();
      expect(utilRatio).to.equal(EXPECTED_UTIL_RATIO);
    });

    it("tests utilRatio is zero when total equity is 0", async () => {
      let utilRatio = await shutdown.finalUtilizationRatio();
      expect(utilRatio).to.equal(0);

      await shutdown.initiateShutdown();

      utilRatio = await shutdown.finalUtilizationRatio();
      expect(utilRatio).to.equal(0);
    });

    it("tests utilRatio is max out at 100%", async () => {
      const EQUITY_TO_SET = RAD.mul(1000);
      const DEBT_TO_SET = RAD.mul(1100);
      const EXPECTED_UTIL_RATIO = WAD;

      let utilRatio = await shutdown.finalUtilizationRatio();
      expect(utilRatio).to.equal(0);

      await vaultEngine.setLendingPoolEquity(EQUITY_TO_SET);
      await vaultEngine.setLendingPoolDebt(DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(DEBT_TO_SET);

      await shutdown.initiateShutdown();

      utilRatio = await shutdown.finalUtilizationRatio();
      expect(utilRatio).to.equal(EXPECTED_UTIL_RATIO);
    });

    it("tests only 'gov' can call initiateShutdown", async () => {
      await assertRevert(
        shutdown.connect(user).initiateShutdown(),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await shutdown.connect(user).initiateShutdown();
    });

    it("can only be called when not in shutdown", async () => {
      await shutdown.initiateShutdown();
      await assertRevert(
        shutdown.initiateShutdown(),
        "Shutdown/onlyWhenNotInShutdown: Shutdown has already been initiated"
      );
    });
  });

  describe("setFinalPrice Unit Tests", function () {
    it("tests that values are properly updated", async () => {
      const PRICE_TO_SET = RAY.mul(12).div(10);
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);

      let coll = await shutdown.assets(ASSET_ID.FLR);
      expect(coll.finalPrice).to.equal(0);

      await shutdown.initiateShutdown();
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      coll = await shutdown.assets(ASSET_ID.FLR);
      expect(coll.finalPrice).to.equal(PRICE_TO_SET);
    });

    it("can only be called when in shutdown", async () => {
      const PRICE_TO_SET = RAY.mul(12).div(10);
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);
      await assertRevert(
        shutdown.setFinalPrice(ASSET_ID.FLR),
        "Shutdown/onlyWhenInShutdown: Shutdown has not been initiated"
      );
      await shutdown.initiateShutdown();
      await shutdown.setFinalPrice(ASSET_ID.FLR);
    });

    it("fails if the price is zero", async () => {
      const PRICE_TO_SET = RAY;
      await priceFeed.setPrice(ASSET_ID.FLR, 0);
      await shutdown.initiateShutdown();

      await assertRevert(
        shutdown.setFinalPrice(ASSET_ID.FLR),
        "Shutdown/setFinalPrice: Price retrieved is zero"
      );
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);
      await shutdown.setFinalPrice(ASSET_ID.FLR);
    });
  });

  describe("processUserDebt Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(987).div(1000);
    const COLL_TO_SET = WAD.mul(100);
    const DEBT_TO_SET = WAD.mul(50);
    const UNDERCOLL_DEBT_TO_SET = COLL_TO_SET.mul(15).div(10);

    beforeEach(async function () {
      await shutdown.initiateShutdown();

      // Final price = $0.987
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);

      await vaultEngine.initAsset(ASSET_ID.FLR, 2);

      // User vault is overcollateralized
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );

      // Owner vault is undercollateralized
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        COLL_TO_SET,
        UNDERCOLL_DEBT_TO_SET,
        0,
        0
      );
    });

    it("tests that values are properly updated", async () => {
      const EXPECTED_GAP = UNDERCOLL_DEBT_TO_SET.mul(RAY)
        .div(PRICE_TO_SET)
        .sub(COLL_TO_SET);
      const EXPECTED_AUR_GAP = EXPECTED_GAP.mul(PRICE_TO_SET);
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      let coll = await shutdown.assets(ASSET_ID.FLR);
      expect(coll.gap).to.equal(0);
      let stablecoinGap = await shutdown.stablecoinGap();
      expect(stablecoinGap).to.equal(0);

      // overcollateralized vaults
      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);

      coll = await shutdown.assets(ASSET_ID.FLR);
      expect(coll.gap).to.equal(0);
      stablecoinGap = await shutdown.stablecoinGap();
      expect(stablecoinGap).to.equal(0);

      // undercollateralized vaults
      await shutdown.processUserDebt(ASSET_ID.FLR, owner.address);

      coll = await shutdown.assets(ASSET_ID.FLR);
      expect(coll.gap).to.equal(EXPECTED_GAP);
      stablecoinGap = await shutdown.stablecoinGap();
      expect(stablecoinGap).to.equal(EXPECTED_AUR_GAP);
    });

    it("tests that correct amount of user's collateral is transferred", async () => {
      const EXPECTED_AMOUNT_TO_GRAB = DEBT_TO_SET.mul(RAY).div(PRICE_TO_SET);
      const EXPECTED_USER_DEBT = DEBT_TO_SET;
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      let lastLiquidateDebtPositionCall =
        await vaultEngine.lastLiquidateDebtPositionCall();
      expect(lastLiquidateDebtPositionCall.assetId).to.equal(BYTES32_ZERO);
      expect(lastLiquidateDebtPositionCall.user).to.equal(ADDRESS_ZERO);
      expect(lastLiquidateDebtPositionCall.auctioneer).to.equal(ADDRESS_ZERO);
      expect(lastLiquidateDebtPositionCall.reservePool).to.equal(ADDRESS_ZERO);
      expect(lastLiquidateDebtPositionCall.collateralAmount).to.equal(0);
      expect(lastLiquidateDebtPositionCall.debtAmount).to.equal(0);

      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);

      lastLiquidateDebtPositionCall =
        await vaultEngine.lastLiquidateDebtPositionCall();
      expect(lastLiquidateDebtPositionCall.assetId).to.equal(ASSET_ID.FLR);
      expect(lastLiquidateDebtPositionCall.user).to.equal(user.address);
      expect(lastLiquidateDebtPositionCall.auctioneer).to.equal(
        shutdown.address
      );
      expect(lastLiquidateDebtPositionCall.reservePool).to.equal(
        shutdown.address
      );
      expect(lastLiquidateDebtPositionCall.collateralAmount).to.equal(
        BigNumber.from(0).sub(EXPECTED_AMOUNT_TO_GRAB)
      );
      expect(lastLiquidateDebtPositionCall.debtAmount).to.equal(
        BigNumber.from(0).sub(EXPECTED_USER_DEBT)
      );
    });

    it("fail if final price is not set", async () => {
      await assertRevert(
        shutdown.processUserDebt(ASSET_ID.FLR, user.address),
        "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this assetId"
      );
      await shutdown.setFinalPrice(ASSET_ID.FLR);
      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);
    });
  });

  describe("freeExcessAsset Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(1);
    const COLL_TO_SET = WAD.mul(100);
    const DEBT_TO_SET = WAD.mul(50);

    beforeEach(async function () {
      await shutdown.initiateShutdown();
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);

      await vaultEngine.initAsset(ASSET_ID.FLR, 2);

      // Overcollateralized
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );
    });

    it("tests that values are properly updated", async () => {
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      await shutdown.freeExcessAsset(ASSET_ID.FLR, owner.address);

      let lastLiquidateVaultCall =
        await vaultEngine.lastLiquidateDebtPositionCall();
      expect(lastLiquidateVaultCall.assetId).to.equal(ASSET_ID.FLR);
      expect(lastLiquidateVaultCall.user).to.equal(owner.address);
      expect(lastLiquidateVaultCall.auctioneer).to.equal(owner.address);
      expect(lastLiquidateVaultCall.reservePool).to.equal(shutdown.address);
      expect(lastLiquidateVaultCall.collateralAmount).to.equal(
        BigNumber.from(0).sub(COLL_TO_SET)
      );
      expect(lastLiquidateVaultCall.debtAmount).to.equal(
        BigNumber.from(0).sub(0)
      );
    });

    it("fail if final price is not set", async () => {
      await assertRevert(
        shutdown.freeExcessAsset(ASSET_ID.FLR, owner.address),
        "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this assetId"
      );
      await shutdown.setFinalPrice(ASSET_ID.FLR);
      await shutdown.freeExcessAsset(ASSET_ID.FLR, owner.address);
    });

    it("fail if userDebt is NOT zero", async () => {
      await shutdown.setFinalPrice(ASSET_ID.FLR);
      await assertRevert(
        shutdown.freeExcessAsset(ASSET_ID.FLR, user.address),
        "Shutdown/freeExcessAsset: User needs to process debt first before calling this"
      );
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );
      await shutdown.freeExcessAsset(ASSET_ID.FLR, user.address);
    });

    it("fail if no excess collateral to free", async () => {
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        0,
        0,
        0,
        0
      );

      await shutdown.setFinalPrice(ASSET_ID.FLR);
      await assertRevert(
        shutdown.freeExcessAsset(ASSET_ID.FLR, owner.address),
        "Shutdown/freeExcessAsset: No collateral to free"
      );
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );
      await shutdown.freeExcessAsset(ASSET_ID.FLR, owner.address);
    });
  });

  describe("calculateInvestorObligation Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(1);
    const COLL_TO_SET = WAD.mul(100);
    const DEBT_TO_SET = WAD.mul(150);
    const TOTAL_DEBT_TO_SET = RAD.mul(100);
    const TOTAL_EQUITY_TO_SET = RAD.mul(150);
    const SYSTEM_DEBT_TO_SET = RAD.mul(10);
    const SYSTEM_RESERVE_TO_SET = RAD.mul(60);
    const TIME_TO_FORWARD = 172800;

    beforeEach(async function () {
      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(TOTAL_EQUITY_TO_SET);
      await shutdown.initiateShutdown();
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);
      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );

      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await vaultEngine.setSystemDebt(reservePool.address, SYSTEM_DEBT_TO_SET);
      await vaultEngine.setStablecoin(
        reservePool.address,
        SYSTEM_RESERVE_TO_SET
      );
      await increaseTime(TIME_TO_FORWARD);
    });

    it("tests that investorObligation calculation is zero when the system surplus >= systemDebt", async () => {
      const TOTAL_DEBT_TO_SET = RAD.mul(100);
      const TOTAL_EQUITY_TO_SET = RAD.mul(150);
      const EXPECTED_AUR_GAP = DEBT_TO_SET.sub(COLL_TO_SET).mul(RAY);

      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);

      let stablecoinGap = await shutdown.stablecoinGap();
      let suppObligation = await shutdown.investorObligationRatio();
      expect(stablecoinGap).to.equal(EXPECTED_AUR_GAP);
      expect(suppObligation).to.equal(0);
      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(TOTAL_EQUITY_TO_SET);

      await vaultEngine.setSystemDebt(reservePool.address, 0);

      await shutdown.writeOffFromReserves();
      await shutdown.setFinalStablecoinBalance();

      await shutdown.calculateInvestorObligation();
      stablecoinGap = await shutdown.stablecoinGap();
      suppObligation = await shutdown.investorObligationRatio();
      // stablecoinGap should be erased
      expect(stablecoinGap).to.equal(0);
      expect(suppObligation).to.equal(0);
    });

    it("tests that investorObligation and systemDebt calculation is correct", async () => {
      const SYSTEM_RESERVE_TO_SET = RAD.mul(10);
      const EXPECTED_SUPP_OBLIGATION = wdiv(RAD.mul(40), RAD.mul(100));

      await vaultEngine.setStablecoin(
        reservePool.address,
        SYSTEM_RESERVE_TO_SET
      );
      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);

      await vaultEngine.setSystemDebt(reservePool.address, 0);

      await shutdown.writeOffFromReserves();
      await shutdown.setFinalStablecoinBalance();

      let suppObligation = await shutdown.investorObligationRatio();
      expect(suppObligation).to.equal(0);
      await shutdown.calculateInvestorObligation();
      suppObligation = await shutdown.investorObligationRatio();
      expect(
        suppObligation.sub(EXPECTED_SUPP_OBLIGATION).abs().lte(WAD.div(100))
      ).to.equal(true);
    });

    it("fail if finalStablecoinBalance is not set", async () => {
      await assertRevert(
        shutdown.calculateInvestorObligation(),
        "shutdown/calculateInvestorObligation: finalStablecoinBalance must be set first"
      );

      await vaultEngine.setSystemDebt(reservePool.address, 0);

      await shutdown.writeOffFromReserves();
      await shutdown.setFinalStablecoinBalance();

      await shutdown.calculateInvestorObligation();
    });

    it("fails if stablecoinGap and systemReserve is non zero", async () => {
      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);
      await vaultEngine.setSystemDebt(reservePool.address, 0);

      await shutdown.setFinalStablecoinBalance();

      await vaultEngine.setStablecoin(reservePool.address, 1);

      await assertRevert(
        shutdown.calculateInvestorObligation(),
        "shutdown/calculateInvestorObligation: system reserve or stablecoin gap must be zero"
      );

      await vaultEngine.setStablecoin(reservePool.address, 0);

      await shutdown.calculateInvestorObligation();
    });
  });

  describe("processUserEquity Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(1);
    const COLL_TO_SET = WAD.mul(100);
    const DEBT_TO_SET = WAD.mul(150);
    const EQUITY_TO_SET = WAD.mul(50);
    const TOTAL_DEBT_TO_SET = RAD.mul(100);
    const TOTAL_EQUITY_TO_SET = RAD.mul(150);
    const SYSTEM_DEBT_TO_SET = RAD.mul(50);
    const SYSTEM_RESERVE_TO_SET = RAD.mul(60);

    beforeEach(async function () {
      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(TOTAL_EQUITY_TO_SET);

      await shutdown.initiateShutdown();
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);
      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        0,
        EQUITY_TO_SET,
        EQUITY_TO_SET.mul(RAY)
      );

      await vaultEngine.setSystemDebt(reservePool.address, SYSTEM_DEBT_TO_SET);
      await vaultEngine.setStablecoin(reservePool.address, 0);
      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);
      await increaseTime(172800);
      await vaultEngine.setSystemDebt(reservePool.address, 0);

      await shutdown.setFinalStablecoinBalance();
    });

    it("fails if investorObligationRatio is zero", async () => {
      await assertRevert(
        shutdown.processUserEquity(ASSET_ID.FLR, owner.address),
        "Shutdown/processUserEquity: Investor has no obligation"
      );
      await shutdown.calculateInvestorObligation();
      await shutdown.processUserEquity(ASSET_ID.FLR, owner.address);
    });

    it("tests that correct amount of collateral is grabbed from equity position", async () => {
      await shutdown.calculateInvestorObligation();

      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.underlying).to.equal(COLL_TO_SET);
      expect(before.normEquity).to.equal(EQUITY_TO_SET);
      await shutdown.processUserEquity(ASSET_ID.FLR, owner.address);

      const lastLiquidateEquityPositionCall =
        await vaultEngine.lastLiquidateEquityPositionCall();
      expect(lastLiquidateEquityPositionCall.assetId).to.equal(ASSET_ID.FLR);
      expect(lastLiquidateEquityPositionCall.user).to.equal(owner.address);
      expect(lastLiquidateEquityPositionCall.assetToReturn).to.equal(
        BigNumber.from(0).sub(COLL_TO_SET)
      );
      expect(lastLiquidateEquityPositionCall.equity).to.equal(
        BigNumber.from(0).sub(EQUITY_TO_SET)
      );
    });
  });

  describe("setFinalStablecoinBalance Unit Tests", function () {
    const DEBT_BALANCE = RAD.mul(21747);

    beforeEach(async function () {
      await vaultEngine.setLendingPoolDebt(DEBT_BALANCE);
      await vaultEngine.setTotalSystemCurrency(DEBT_BALANCE);

      await shutdown.initiateShutdown();
    });

    it("tests that proper value is updated", async () => {
      await increaseTime(172800 * 2);

      const before = await shutdown.finalStablecoinBalance();
      expect(before).to.equal(0);
      await shutdown.setFinalStablecoinBalance();

      const after = await shutdown.finalStablecoinBalance();
      expect(after).to.equal(DEBT_BALANCE);
    });

    it("fails if supplierWaitPeriod has not passed", async () => {
      await assertRevert(
        shutdown.setFinalStablecoinBalance(),
        "shutdown/setFinalStablecoinBalance: Waiting for auctions to complete"
      );
      await increaseTime(172800 * 2);
      await shutdown.setFinalStablecoinBalance();
    });

    it("fails if system Debt and system reserve is non zero", async () => {
      await increaseTime(172800 * 2);

      await vaultEngine.setStablecoin(reservePool.address, 1);
      await vaultEngine.setSystemDebt(reservePool.address, 1);
      await assertRevert(
        shutdown.setFinalStablecoinBalance(),
        "shutdown/setFinalStablecoinBalance: system reserve or debt must be zero"
      );

      await vaultEngine.setSystemDebt(reservePool.address, 0);

      // await shutdown.setFinalStablecoinBalance()
    });

    it("fails if the final debt balance is already set", async () => {
      await increaseTime(172800 * 2);
      await shutdown.setFinalStablecoinBalance();

      await assertRevert(
        shutdown.setFinalStablecoinBalance(),
        "shutdown/setFinalStablecoinBalance: Balance already set"
      );
    });
  });

  describe("calculateRedemptionRatio Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(1);
    const UNDERLYING_TO_SET = WAD.mul(100);
    const COLL_TO_SET = WAD.mul(100);
    const DEBT_TO_SET = WAD.mul(150);
    const EQUITY_TO_SET = WAD.mul(50);
    const TOTAL_DEBT_TO_SET = RAD.mul(150);
    const TOTAL_EQUITY_TO_SET = RAD.mul(150);

    beforeEach(async function () {
      // User vault
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      // Owner vault
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        UNDERLYING_TO_SET,
        COLL_TO_SET,
        0,
        EQUITY_TO_SET,
        EQUITY_TO_SET.mul(RAY)
      );

      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(TOTAL_EQUITY_TO_SET);
      await vaultEngine.updateAsset(
        ASSET_ID.FLR,
        0,
        DEBT_TO_SET,
        EQUITY_TO_SET,
        0,
        0
      );

      await shutdown.initiateShutdown();
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);
      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      await increaseTime(172800);
      await increaseTime(172800);
    });

    it("calculates the redemption ratio with a zero gap", async () => {
      let expected = RAY;

      await shutdown.setFinalStablecoinBalance();
      await shutdown.calculateRedemptionRatio(ASSET_ID.FLR);

      const asset = await shutdown.assets(ASSET_ID.FLR);
      expect(asset.redemptionRatio).to.equal(expected);
    });

    it("calculates redemption ratio with a non-zero gap", async () => {
      await shutdown.setFinalStablecoinBalance();
      await shutdown.processUserDebt(ASSET_ID.FLR, user.address);
      let expected = RAY.mul(2).div(3);

      await shutdown.calculateRedemptionRatio(ASSET_ID.FLR);

      const asset = await shutdown.assets(ASSET_ID.FLR);
      expect(asset.redemptionRatio).to.equal(expected);
    });

    it("fails if the final debt balance is not set", async () => {
      await assertRevert(
        shutdown.calculateRedemptionRatio(ASSET_ID.FLR),
        "shutdown/calculateRedemptionRatio: Must set final debt balance first"
      );
      await shutdown.setFinalStablecoinBalance();

      await shutdown.calculateRedemptionRatio(ASSET_ID.FLR);
    });
  });

  describe("returnStablecoin Unit Tests", function () {
    const AUREI_AMOUNT_TO_SET = RAD.mul(2000);
    beforeEach(async function () {
      await vaultEngine.setStablecoin(owner.address, AUREI_AMOUNT_TO_SET);
    });

    it("tests that correct amount of usd are transferred", async () => {
      const AMOUNT_TO_RETURN = AUREI_AMOUNT_TO_SET.div(10);
      const stablecoinBalanceBefore = await vaultEngine.systemCurrency(
        shutdown.address
      );

      await shutdown.returnStablecoin(AMOUNT_TO_RETURN);

      const stablecoinBalanceAfter = await vaultEngine.systemCurrency(
        shutdown.address
      );
      expect(stablecoinBalanceAfter.sub(stablecoinBalanceBefore)).to.equal(
        AMOUNT_TO_RETURN
      );
    });

    it("tests that values are properly updated", async () => {
      const AMOUNT_TO_RETURN = AUREI_AMOUNT_TO_SET.div(10);
      const stablecoinBalanceBefore = await shutdown.stablecoin(owner.address);

      await shutdown.returnStablecoin(AMOUNT_TO_RETURN);

      const stablecoinBalanceAfter = await shutdown.stablecoin(owner.address);
      expect(stablecoinBalanceAfter.sub(stablecoinBalanceBefore)).to.equal(
        AMOUNT_TO_RETURN
      );
    });
  });

  describe("redeemAsset Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(1);
    const COLL_TO_SET = WAD.mul(100);
    const DEBT_TO_SET = WAD.mul(150);
    const EQUITY_TO_SET = WAD.mul(50);
    const TOTAL_DEBT_TO_SET = RAD.mul(150);
    const TOTAL_EQUITY_TO_SET = RAD.mul(150);
    const AUREI_AMOUNT_TO_SET = TOTAL_DEBT_TO_SET;

    beforeEach(async function () {
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        COLL_TO_SET,
        0,
        EQUITY_TO_SET,
        EQUITY_TO_SET.mul(RAY)
      );

      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(TOTAL_EQUITY_TO_SET);
      await vaultEngine.updateAsset(
        ASSET_ID.FLR,
        0,
        DEBT_TO_SET,
        EQUITY_TO_SET,
        0,
        0
      );

      await shutdown.initiateShutdown();
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);
      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      await increaseTime(172800);
      await increaseTime(172800);
      await shutdown.setFinalStablecoinBalance();
      await shutdown.calculateRedemptionRatio(ASSET_ID.FLR);

      await vaultEngine.setStablecoin(owner.address, AUREI_AMOUNT_TO_SET);
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        shutdown.address,
        DEBT_TO_SET,
        0,
        0,
        0,
        0,
        0
      );
    });

    it("tests that values are properly updated", async () => {
      await shutdown.returnStablecoin(AUREI_AMOUNT_TO_SET);

      const before = await shutdown.collRedeemed(ASSET_ID.FLR, owner.address);
      await shutdown.redeemAsset(ASSET_ID.FLR);
      const after = await shutdown.collRedeemed(ASSET_ID.FLR, owner.address);
      expect(after.sub(before)).to.equal(DEBT_TO_SET);
    });

    it("tests that if more usd is returned, more collateral can be withdrawn", async () => {
      await shutdown.returnStablecoin(AUREI_AMOUNT_TO_SET.mul(2).div(3));

      let before = await shutdown.collRedeemed(ASSET_ID.FLR, owner.address);

      await shutdown.redeemAsset(ASSET_ID.FLR);

      let after = await shutdown.collRedeemed(ASSET_ID.FLR, owner.address);
      expect(after.sub(before)).to.equal(DEBT_TO_SET.mul(2).div(3));

      await shutdown.returnStablecoin(AUREI_AMOUNT_TO_SET.div(3));
      before = await shutdown.collRedeemed(ASSET_ID.FLR, owner.address);

      await shutdown.redeemAsset(ASSET_ID.FLR);

      after = await shutdown.collRedeemed(ASSET_ID.FLR, owner.address);
      expect(after.sub(before)).to.equal(DEBT_TO_SET.div(3));
    });

    it("tests that correct Amount of collateral has been transferred", async () => {
      await shutdown.returnStablecoin(AUREI_AMOUNT_TO_SET);

      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      await shutdown.redeemAsset(ASSET_ID.FLR);
      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);

      expect(after.standbyAmount.sub(before.standbyAmount)).to.equal(
        DEBT_TO_SET
      );
    });
  });

  describe("writeOffFromReserve Unit Tests", function () {
    const PRICE_TO_SET = RAY.mul(987).div(1000);
    const COLL_TO_SET = WAD.mul(100);
    const UNDERCOLL_DEBT_TO_SET = COLL_TO_SET.mul(15).div(10);

    beforeEach(async function () {
      await shutdown.initiateShutdown();

      // Final price = $0.987
      await priceFeed.setPrice(ASSET_ID.FLR, PRICE_TO_SET);

      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await shutdown.setFinalPrice(ASSET_ID.FLR);

      // Owner vault is undercollateralized
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        owner.address,
        0,
        0,
        COLL_TO_SET,
        UNDERCOLL_DEBT_TO_SET,
        0,
        0
      );
    });

    it("fails if system debt is not zero", async () => {
      await vaultEngine.setSystemDebt(reservePool.address, 1);

      await assertRevert(
        shutdown.writeOffFromReserves(),
        "shutdown/writeOffFromReserves: the system debt needs to be zero before write off can happen"
      );
      await vaultEngine.setSystemDebt(reservePool.address, 0);

      await shutdown.writeOffFromReserves();
    });

    it("tests that correct amount of stablecoinGap is reduced by using the system Reserve", async () => {
      const SYSTEM_RESERVE = 1;

      await shutdown.processUserDebt(ASSET_ID.FLR, owner.address);

      await vaultEngine.setStablecoin(reservePool.address, SYSTEM_RESERVE);

      const before = await shutdown.stablecoinGap();
      await shutdown.writeOffFromReserves();

      const after = await shutdown.stablecoinGap();
      expect(before.sub(after)).to.equal(SYSTEM_RESERVE);
    });
  });

  describe("setFinalSystemReserve Unit Tests", function () {
    const TOTAL_DEBT_TO_SET = RAD.mul(150);

    beforeEach(async function () {
      await shutdown.initiateShutdown();

      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await increaseTime(172800 * 2);
      await increaseTime(172800);
    });

    it("fails if finalStablecoinBalance is not set", async () => {
      await vaultEngine.setStablecoin(reservePool.address, 1);

      await assertRevert(
        shutdown.setFinalSystemReserve(),
        "shutdown/redeemBondTokens: finalStablecoinBalance must be set first"
      );
      await shutdown.setFinalStablecoinBalance();

      await shutdown.setFinalSystemReserve();
    });

    it("fails if system reserve is zero", async () => {
      await shutdown.setFinalStablecoinBalance();

      await vaultEngine.setStablecoin(reservePool.address, 0);

      await assertRevert(
        shutdown.setFinalSystemReserve(),
        "shutdown/setFinalSystemReserve: system reserve is zero"
      );

      await vaultEngine.setStablecoin(reservePool.address, 1);
      await shutdown.setFinalSystemReserve();
    });

    it("tests that finalTotalReserve is set correctly", async () => {
      const SYSTEM_RESERVE_TO_SET = 1;
      await shutdown.setFinalStablecoinBalance();

      await vaultEngine.setStablecoin(
        reservePool.address,
        SYSTEM_RESERVE_TO_SET
      );

      const before = await shutdown.finalTotalReserve();
      expect(before).to.equal(0);

      await shutdown.setFinalSystemReserve();

      const after = await shutdown.finalTotalReserve();
      expect(after).to.equal(SYSTEM_RESERVE_TO_SET);
    });
  });

  describe("redeemBondTokens Unit Tests", function () {
    const TOTAL_DEBT_TO_SET = RAD.mul(150);

    beforeEach(async function () {
      await shutdown.initiateShutdown();

      await vaultEngine.setLendingPoolDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalSystemCurrency(TOTAL_DEBT_TO_SET);
      await increaseTime(172800 * 2);
      await increaseTime(172800);
      await shutdown.setFinalStablecoinBalance();
      await bondIssuer.setTotalBondTokens(RAD);
      await vaultEngine.setStablecoin(reservePool.address, RAD.mul(1000));
    });

    it("fails if finalTotalReserve is not set", async () => {
      await bondIssuer.setTokens(owner.address, RAD);
      await assertRevert(
        shutdown.redeemBondTokens(),
        "shutdown/redeemBondTokens: finalTotalReserve must be set first"
      );
      await shutdown.setFinalSystemReserve();

      await shutdown.redeemBondTokens();
    });

    it("fails if user's amount of tokens is zero", async () => {
      await shutdown.setFinalSystemReserve();

      await assertRevert(
        shutdown.redeemBondTokens(),
        "shutdown/redeemBondTokens: no bond tokens to redeem"
      );
      await bondIssuer.setTokens(owner.address, RAD);
      await shutdown.redeemBondTokens();
    });

    it("fails if total tokens are zero", async () => {
      await shutdown.setFinalSystemReserve();
      await bondIssuer.setTokens(owner.address, RAD);
      await bondIssuer.setTotalBondTokens(0);

      await assertRevert(
        shutdown.redeemBondTokens(),
        "shutdown/redeemBondTokens: no bond tokens to redeem"
      );
      await bondIssuer.setTotalBondTokens(RAD);
      await shutdown.redeemBondTokens();
    });

    it("tests that shutdownRedemption is called with correct parameter", async () => {
      const TOTAL_IOU = RAD.mul(382);
      const USER_IOU = RAD.mul(28);
      const finalTotalReserve = RAD.mul(100);

      await vaultEngine.setStablecoin(reservePool.address, finalTotalReserve);
      await shutdown.setFinalSystemReserve();

      const EXPECTED_AMOUNT = rmul(
        rdiv(USER_IOU, TOTAL_IOU),
        finalTotalReserve
      );
      await bondIssuer.setTokens(owner.address, USER_IOU);
      await bondIssuer.setTotalBondTokens(TOTAL_IOU);

      await shutdown.redeemBondTokens();

      const lastCall = await bondIssuer.lastRedemptionCall();
      expect(lastCall.user).to.equal(owner.address);
      expect(lastCall.amount).to.equal(EXPECTED_AMOUNT);
    });
  });
});
