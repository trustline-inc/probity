import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Aurei,
  Liquidator,
  MockAuctioneer,
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
  bytes32,
  BYTES32_ZERO,
  PRECISION_AUR,
  PRECISION_COLL,
  PRECISION_PRICE,
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

let flrCollId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Shutdown Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.mockVaultEngine;
    teller = contracts.teller;
    priceFeed = contracts.mockPriceFeed;
    treasury = contracts.treasury;
    liquidator = contracts.mockLiquidator;
    reservePool = contracts.mockReserve;
    auctioneer = contracts.mockAuctioneer;

    contracts = await probity.deployShutdown({
      vaultEngine: vaultEngine.address,
      priceFeed: priceFeed.address,
      liquidator: liquidator.address,
      reservePool: reservePool.address,
    });

    shutdown = contracts.shutdown;

    owner = signers.owner;
    user = signers.alice;
    await liquidator.setCollateralType(flrCollId, auctioneer.address);
  });

  describe("switchAddress Unit Tests", function () {
    it("tests priceFeed address switch", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.priceFeed();
      expect(before).to.equal(priceFeed.address);
      await shutdown.switchAddress(bytes32("PriceFeed"), NEW_ADDRESS);
      const after = await shutdown.priceFeed();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("tests vaultEngine address switch", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.vaultEngine();
      expect(before).to.equal(vaultEngine.address);
      await shutdown.switchAddress(bytes32("VaultEngine"), NEW_ADDRESS);
      const after = await shutdown.vaultEngine();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("tests reservePool address switch", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.reservePool();
      expect(before).to.equal(reservePool.address);
      await shutdown.switchAddress(bytes32("ReservePool"), NEW_ADDRESS);
      const after = await shutdown.reservePool();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("tests Teller address switch", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.teller();
      expect(before).to.equal(teller.address);
      await shutdown.switchAddress(bytes32("Teller"), NEW_ADDRESS);
      const after = await shutdown.teller();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("tests Treasury address switch", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.treasury();
      expect(before).to.equal(treasury.address);
      await shutdown.switchAddress(bytes32("Treasury"), NEW_ADDRESS);
      const after = await shutdown.treasury();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("tests Liquidator address switch", async () => {
      const NEW_ADDRESS = user.address;

      const before = await shutdown.liquidator();
      expect(before).to.equal(liquidator.address);
      await shutdown.switchAddress(bytes32("Liquidator"), NEW_ADDRESS);
      const after = await shutdown.liquidator();
      expect(after).to.equal(NEW_ADDRESS);
    });

    it("fail if which is unknown", async () => {
      await assertRevert(
        shutdown.switchAddress(bytes32("unknown"), user.address),
        "shutdown/switchAddress: unknown which"
      );
      await shutdown.switchAddress(bytes32("VaultEngine"), user.address);
    });

    it("fail if shutdown is set", async () => {
      await shutdown.switchAddress(bytes32("PriceFeed"), priceFeed.address);
      await shutdown.initiateShutdown();
      await assertRevert(
        shutdown.switchAddress(bytes32("PriceFeed"), user.address),
        "Shutdown/onlyWhenNotInShutdown: Shutdown has already been initiated"
      );
    });

    it("fail if not from gov", async () => {
      await assertRevert(
        shutdown
          .connect(user)
          .switchAddress(bytes32("PriceFeed"), user.address),
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
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
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
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
      const CAPITAL_TO_SET = PRECISION_AUR.mul(1000);
      const DEBT_TO_SET = PRECISION_AUR.mul(342);
      const EXPECTED_UTIL_RATIO = wdiv(DEBT_TO_SET, CAPITAL_TO_SET);

      let initiated = await shutdown.initiated();
      expect(initiated).to.equal(false);
      let initiatedAt = await shutdown.initiatedAt();
      expect(initiatedAt).to.equal(0);
      let utilRatio = await shutdown.finalAurUtilizationRatio();
      expect(utilRatio).to.equal(0);

      await vaultEngine.setTotalCapital(CAPITAL_TO_SET);
      await vaultEngine.setTotalDebt(DEBT_TO_SET);

      await shutdown.initiateShutdown();

      initiated = await shutdown.initiated();
      expect(initiated).to.equal(true);
      initiatedAt = await shutdown.initiatedAt();
      expect(initiatedAt).to.not.equal(0);
      utilRatio = await shutdown.finalAurUtilizationRatio();
      expect(utilRatio).to.equal(EXPECTED_UTIL_RATIO);
    });

    it("tests utilRatio is zero when total capital is 0", async () => {
      let utilRatio = await shutdown.finalAurUtilizationRatio();
      expect(utilRatio).to.equal(0);

      await shutdown.initiateShutdown();

      utilRatio = await shutdown.finalAurUtilizationRatio();
      expect(utilRatio).to.equal(0);
    });

    it("tests utilRatio is max out at 100%", async () => {
      const CAPITAL_TO_SET = PRECISION_AUR.mul(1000);
      const DEBT_TO_SET = PRECISION_AUR.mul(1100);
      const EXPECTED_UTIL_RATIO = PRECISION_PRICE;

      let utilRatio = await shutdown.finalAurUtilizationRatio();
      expect(utilRatio).to.equal(0);

      await vaultEngine.setTotalCapital(CAPITAL_TO_SET);
      await vaultEngine.setTotalDebt(DEBT_TO_SET);

      await shutdown.initiateShutdown();

      utilRatio = await shutdown.finalAurUtilizationRatio();
      expect(utilRatio).to.equal(EXPECTED_UTIL_RATIO);
    });

    it("tests only 'gov' can call initiateShutdown", async () => {
      await assertRevert(
        shutdown.connect(user).initiateShutdown(),
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
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
      const PRICE_TO_SET = PRECISION_PRICE.mul(12).div(10);
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);

      let coll = await shutdown.collateralTypes(flrCollId);
      expect(coll.finalPrice).to.equal(0);

      await shutdown.initiateShutdown();
      await shutdown.setFinalPrice(flrCollId);

      coll = await shutdown.collateralTypes(flrCollId);
      expect(coll.finalPrice).to.equal(PRICE_TO_SET);
    });

    it("can only be called when in shutdown", async () => {
      const PRICE_TO_SET = PRECISION_PRICE.mul(12).div(10);
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);
      await assertRevert(
        shutdown.setFinalPrice(flrCollId),
        "Shutdown/onlyWhenInShutdown: Shutdown has not been initiated"
      );
      await shutdown.initiateShutdown();
      await shutdown.setFinalPrice(flrCollId);
    });

    it("fail if price is zero", async () => {
      const PRICE_TO_SET = PRECISION_PRICE;
      await priceFeed.setPrice(flrCollId, 0);
      await shutdown.initiateShutdown();

      await assertRevert(
        shutdown.setFinalPrice(flrCollId),
        "Shutdown/setFinalPrice: price retrieved is zero"
      );
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);
      await shutdown.setFinalPrice(flrCollId);
    });
  });

  describe("processUserDebt Unit Tests", function () {
    const PRICE_TO_SET = PRECISION_PRICE.mul(987).div(1000);
    const COLL_TO_SET = PRECISION_COLL.mul(100);
    const DEBT_TO_SET = PRECISION_COLL.mul(50);
    const UNDERCOLL_DEBT_TO_SET = COLL_TO_SET.mul(15).div(10);

    beforeEach(async function () {
      await shutdown.initiateShutdown();
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);

      await vaultEngine.initCollType(flrCollId);

      // overCollateralized
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );

      // underCollateralized
      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        UNDERCOLL_DEBT_TO_SET,
        0,
        0
      );
    });

    it("tests that values are properly updated", async () => {
      const EXPECTED_GAP = UNDERCOLL_DEBT_TO_SET.mul(PRECISION_PRICE)
        .div(PRICE_TO_SET)
        .sub(COLL_TO_SET);
      const EXPECTED_AUR_GAP = EXPECTED_GAP.mul(PRICE_TO_SET);
      await shutdown.setFinalPrice(flrCollId);

      let coll = await shutdown.collateralTypes(flrCollId);
      expect(coll.gap).to.equal(0);
      let aurGap = await shutdown.aurGap();
      expect(aurGap).to.equal(0);

      // overcollateralized vaults
      await shutdown.processUserDebt(flrCollId, user.address);

      coll = await shutdown.collateralTypes(flrCollId);
      expect(coll.gap).to.equal(0);
      aurGap = await shutdown.aurGap();
      expect(aurGap).to.equal(0);

      // undercollateralized vaults
      await shutdown.processUserDebt(flrCollId, owner.address);

      coll = await shutdown.collateralTypes(flrCollId);
      expect(coll.gap).to.equal(EXPECTED_GAP);
      aurGap = await shutdown.aurGap();
      expect(aurGap).to.equal(EXPECTED_AUR_GAP);
    });

    it("tests that correct amount of user's collateral is transferred", async () => {
      const EXPECTED_AMOUNT_TO_GRAB =
        DEBT_TO_SET.mul(PRECISION_PRICE).div(PRICE_TO_SET);
      const EXPECTED_USER_DEBT = DEBT_TO_SET;
      await shutdown.setFinalPrice(flrCollId);

      let lastLiquidateVaultCall = await vaultEngine.lastLiquidateVaultCall();
      expect(lastLiquidateVaultCall.collId).to.equal(BYTES32_ZERO);
      expect(lastLiquidateVaultCall.user).to.equal(ADDRESS_ZERO);
      expect(lastLiquidateVaultCall.auctioneer).to.equal(ADDRESS_ZERO);
      expect(lastLiquidateVaultCall.reservePool).to.equal(ADDRESS_ZERO);
      expect(lastLiquidateVaultCall.collateralAmount).to.equal(0);
      expect(lastLiquidateVaultCall.debtAmount).to.equal(0);
      expect(lastLiquidateVaultCall.capitalAmount).to.equal(0);

      await shutdown.processUserDebt(flrCollId, user.address);

      lastLiquidateVaultCall = await vaultEngine.lastLiquidateVaultCall();
      expect(lastLiquidateVaultCall.collId).to.equal(flrCollId);
      expect(lastLiquidateVaultCall.user).to.equal(user.address);
      expect(lastLiquidateVaultCall.auctioneer).to.equal(shutdown.address);
      expect(lastLiquidateVaultCall.reservePool).to.equal(shutdown.address);
      expect(lastLiquidateVaultCall.collateralAmount).to.equal(
        BigNumber.from(0).sub(EXPECTED_AMOUNT_TO_GRAB)
      );
      expect(lastLiquidateVaultCall.debtAmount).to.equal(
        BigNumber.from(0).sub(EXPECTED_USER_DEBT)
      );
      expect(lastLiquidateVaultCall.capitalAmount).to.equal(0);
    });

    it("fail if final price is not set", async () => {
      await assertRevert(
        shutdown.processUserDebt(flrCollId, user.address),
        "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this collId"
      );
      await shutdown.setFinalPrice(flrCollId);
      await shutdown.processUserDebt(flrCollId, user.address);
    });
  });

  describe("freeExcessCollateral Unit Tests", function () {
    const PRICE_TO_SET = PRECISION_PRICE.mul(1);
    const COLL_TO_SET = PRECISION_COLL.mul(100);
    const DEBT_TO_SET = PRECISION_COLL.mul(50);

    beforeEach(async function () {
      await shutdown.initiateShutdown();
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);

      await vaultEngine.initCollType(flrCollId);

      // overCollateralized
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );

      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );
    });

    it("tests that values are properly updated", async () => {
      await shutdown.setFinalPrice(flrCollId);

      await shutdown.freeExcessCollateral(flrCollId, owner.address);

      let lastLiquidateVaultCall = await vaultEngine.lastLiquidateVaultCall();
      expect(lastLiquidateVaultCall.collId).to.equal(flrCollId);
      expect(lastLiquidateVaultCall.user).to.equal(owner.address);
      expect(lastLiquidateVaultCall.auctioneer).to.equal(owner.address);
      expect(lastLiquidateVaultCall.reservePool).to.equal(shutdown.address);
      expect(lastLiquidateVaultCall.collateralAmount).to.equal(
        BigNumber.from(0).sub(COLL_TO_SET)
      );
      expect(lastLiquidateVaultCall.debtAmount).to.equal(
        BigNumber.from(0).sub(0)
      );
      expect(lastLiquidateVaultCall.capitalAmount).to.equal(0);
    });

    it("fail if final price is not set", async () => {
      await assertRevert(
        shutdown.freeExcessCollateral(flrCollId, owner.address),
        "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this collId"
      );
      await shutdown.setFinalPrice(flrCollId);
      await shutdown.freeExcessCollateral(flrCollId, owner.address);
    });

    it("fail if userDebt is NOT zero", async () => {
      await shutdown.setFinalPrice(flrCollId);
      await assertRevert(
        shutdown.freeExcessCollateral(flrCollId, user.address),
        "Shutdown/freeExcessCollateral: User needs to process debt first before calling this"
      );
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );
      await shutdown.freeExcessCollateral(flrCollId, user.address);
    });

    it("fail if no excess collateral to free", async () => {
      await vaultEngine.updateVault(flrCollId, owner.address, 0, 0, 0, 0, 0);

      await shutdown.setFinalPrice(flrCollId);
      await assertRevert(
        shutdown.freeExcessCollateral(flrCollId, owner.address),
        "Shutdown/freeExcessCollateral: No collateral to free"
      );
      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );
      await shutdown.freeExcessCollateral(flrCollId, owner.address);
    });
  });

  describe("calculateSupplierObligation Unit Tests", function () {
    const PRICE_TO_SET = PRECISION_PRICE.mul(1);
    const COLL_TO_SET = PRECISION_COLL.mul(100);
    const DEBT_TO_SET = PRECISION_COLL.mul(150);
    const TOTAL_DEBT_TO_SET = PRECISION_AUR.mul(100);
    const TOTAL_CAP_TO_SET = PRECISION_AUR.mul(150);
    const SYSTEM_DEBT_TO_SET = PRECISION_AUR.mul(10);
    const SYSTEM_RESERVE_TO_SET = PRECISION_AUR.mul(60);
    const TIME_TO_FORWARD = 172800;

    beforeEach(async function () {
      await shutdown.initiateShutdown();
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);
      await vaultEngine.initCollType(flrCollId);
      await shutdown.setFinalPrice(flrCollId);

      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        0,
        0
      );

      await vaultEngine.setTotalDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalCapital(TOTAL_CAP_TO_SET);
      await vaultEngine.setUnbackedAurei(
        reservePool.address,
        SYSTEM_DEBT_TO_SET
      );
      await vaultEngine.setAurei(reservePool.address, SYSTEM_RESERVE_TO_SET);
      await increaseTime(TIME_TO_FORWARD);
    });

    it("tests that supplierObligation calculation is zero when the system surplus >= aurGap", async () => {
      const TOTAL_DEBT_TO_SET = PRECISION_AUR.mul(100);
      const TOTAL_CAP_TO_SET = PRECISION_AUR.mul(150);
      const EXPECTED_AUR_GAP =
        DEBT_TO_SET.sub(COLL_TO_SET).mul(PRECISION_PRICE);

      await shutdown.processUserDebt(flrCollId, user.address);

      let aurGap = await shutdown.aurGap();
      let suppObligation = await shutdown.supplierObligationRatio();
      expect(aurGap).to.equal(EXPECTED_AUR_GAP);
      expect(suppObligation).to.equal(0);
      await vaultEngine.setTotalDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalCapital(TOTAL_CAP_TO_SET);

      await vaultEngine.setUnbackedAurei(reservePool.address, 0);

      await shutdown.fillInAurGap();
      await shutdown.setFinalDebtBalance();

      await shutdown.calculateSupplierObligation();
      aurGap = await shutdown.aurGap();
      suppObligation = await shutdown.supplierObligationRatio();
      // aurGap should be erased
      expect(aurGap).to.equal(0);
      expect(suppObligation).to.equal(0);
    });

    it("tests that supplierObligation and aurGap calculation is correct", async () => {
      const SYSTEM_RESERVE_TO_SET = PRECISION_AUR.mul(10);
      const EXPECTED_SUPP_OBLIGATION = wdiv(
        PRECISION_AUR.mul(40),
        PRECISION_AUR.mul(100)
      );

      await vaultEngine.setAurei(reservePool.address, SYSTEM_RESERVE_TO_SET);
      await shutdown.processUserDebt(flrCollId, user.address);

      await vaultEngine.setUnbackedAurei(reservePool.address, 0);

      await shutdown.fillInAurGap();
      await shutdown.setFinalDebtBalance();

      let suppObligation = await shutdown.supplierObligationRatio();
      expect(suppObligation).to.equal(0);
      await shutdown.calculateSupplierObligation();
      suppObligation = await shutdown.supplierObligationRatio();
      expect(suppObligation).to.equal(EXPECTED_SUPP_OBLIGATION);
    });

    it("tests that supplierObligation max out at 100%", async () => {
      const SYSTEM_RESERVE_TO_SET = PRECISION_AUR.mul(10);
      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(30));

      const EXPECTED_SUPP_OBLIGATION = PRECISION_COLL;

      await vaultEngine.setAurei(reservePool.address, SYSTEM_RESERVE_TO_SET);
      await shutdown.processUserDebt(flrCollId, user.address);

      await vaultEngine.setUnbackedAurei(reservePool.address, 0);

      await shutdown.fillInAurGap();
      await shutdown.setFinalDebtBalance();

      let suppObligation = await shutdown.supplierObligationRatio();
      expect(suppObligation).to.equal(0);
      await shutdown.calculateSupplierObligation();
      suppObligation = await shutdown.supplierObligationRatio();
      expect(suppObligation).to.equal(EXPECTED_SUPP_OBLIGATION);
    });

    it("fail if finalDebtBalance is not set", async () => {
      await assertRevert(
        shutdown.calculateSupplierObligation(),
        "shutdown/setFinalDebtBalance: finalDebtBalance must be set first"
      );

      await vaultEngine.setUnbackedAurei(reservePool.address, 0);

      await shutdown.fillInAurGap();
      await shutdown.setFinalDebtBalance();

      await shutdown.calculateSupplierObligation();
    });
  });

  describe("processUserSupply Unit Tests", function () {
    const PRICE_TO_SET = PRECISION_PRICE.mul(1);
    const COLL_TO_SET = PRECISION_COLL.mul(100);
    const DEBT_TO_SET = PRECISION_COLL.mul(150);
    const CAP_TO_SET = PRECISION_COLL.mul(50);
    const TOTAL_DEBT_TO_SET = PRECISION_AUR.mul(100);
    const TOTAL_CAP_TO_SET = PRECISION_AUR.mul(150);
    const SYSTEM_DEBT_TO_SET = PRECISION_AUR.mul(50);
    const SYSTEM_RESERVE_TO_SET = PRECISION_AUR.mul(60);

    beforeEach(async function () {
      await vaultEngine.setTotalDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalCapital(TOTAL_CAP_TO_SET);

      await shutdown.initiateShutdown();
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);
      await vaultEngine.initCollType(flrCollId);
      await shutdown.setFinalPrice(flrCollId);

      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        CAP_TO_SET,
        0
      );

      await vaultEngine.setUnbackedAurei(
        reservePool.address,
        SYSTEM_DEBT_TO_SET
      );
      await vaultEngine.setAurei(reservePool.address, 0);
      await shutdown.processUserDebt(flrCollId, user.address);
      await increaseTime(172800);
      await vaultEngine.setUnbackedAurei(reservePool.address, 0);

      await shutdown.setFinalDebtBalance();
    });

    it("fails if supplierObligationRatio is zero", async () => {
      await assertRevert(
        shutdown.processUserSupply(flrCollId, owner.address),
        "Shutdown/processUserSupply:Supplier has no obligation"
      );
      await shutdown.calculateSupplierObligation();
      await shutdown.processUserSupply(flrCollId, owner.address);
    });

    it("tests that correct amount of collateral is grabbed from supplier", async () => {
      await shutdown.calculateSupplierObligation();
      const obligationRatio = await shutdown.supplierObligationRatio();
      const finalAurUtilizationRatio =
        await shutdown.finalAurUtilizationRatio();

      const before = await vaultEngine.vaults(flrCollId, owner.address);
      expect(before.usedCollateral).to.equal(COLL_TO_SET);
      expect(before.capital).to.equal(CAP_TO_SET);
      await shutdown.processUserSupply(flrCollId, owner.address);

      const EXPECTED_AMOUNT = before.capital
        .mul(PRECISION_PRICE)
        .mul(finalAurUtilizationRatio)
        .div(PRECISION_COLL)
        .mul(obligationRatio)
        .div(PRECISION_COLL)
        .div(PRICE_TO_SET);

      const lastLiqudateVaultCall = await vaultEngine.lastLiquidateVaultCall();
      expect(lastLiqudateVaultCall.collId).to.equal(flrCollId);
      expect(lastLiqudateVaultCall.user).to.equal(owner.address);
      expect(lastLiqudateVaultCall.auctioneer).to.equal(shutdown.address);
      expect(lastLiqudateVaultCall.reservePool).to.equal(shutdown.address);
      expect(lastLiqudateVaultCall.collateralAmount).to.equal(
        BigNumber.from(0).sub(EXPECTED_AMOUNT)
      );

      expect(lastLiqudateVaultCall.debtAmount).to.equal(0);
      expect(lastLiqudateVaultCall.capitalAmount).to.equal(
        BigNumber.from(0).sub(before.capital)
      );
    });
  });

  describe("setFinalDebtBalance Unit Tests", function () {
    const DEBT_BALANCE = PRECISION_AUR.mul(21747);

    beforeEach(async function () {
      await vaultEngine.setTotalDebt(DEBT_BALANCE);

      await shutdown.initiateShutdown();
    });

    it("tests that proper value is updated", async () => {
      await increaseTime(172800 * 2);

      const before = await shutdown.finalDebtBalance();
      expect(before).to.equal(0);
      await shutdown.setFinalDebtBalance();

      const after = await shutdown.finalDebtBalance();
      expect(after).to.equal(DEBT_BALANCE);
    });

    it("fails if supplierWaitPeriod has not passed", async () => {
      await assertRevert(
        shutdown.setFinalDebtBalance(),
        "shutdown/setFinalDebtBalance: supplierWaitPeriod has not passed yet"
      );
      await increaseTime(172800 * 2);
      await shutdown.setFinalDebtBalance();
    });

    it("fails if system Debt and system reserve is non zero", async () => {
      await increaseTime(172800 * 2);

      await vaultEngine.setAurei(reservePool.address, 1);
      await vaultEngine.setUnbackedAurei(reservePool.address, 1);
      await assertRevert(
        shutdown.setFinalDebtBalance(),
        "shutdown/setFinalDebtBalance: system reserve or debt must be zero"
      );

      await vaultEngine.setUnbackedAurei(reservePool.address, 0);

      // await shutdown.setFinalDebtBalance()
    });

    it("fails if finalDebtBalance is already set", async () => {
      await increaseTime(172800 * 2);
      await shutdown.setFinalDebtBalance();

      await assertRevert(
        shutdown.setFinalDebtBalance(),
        "shutdown/setFinalDebtBalance: finalDebtBalance has already been set"
      );
    });
  });

  describe("calculateRedeemRatio Unit Tests", function () {
    const PRICE_TO_SET = PRECISION_PRICE.mul(1);
    const COLL_TO_SET = PRECISION_COLL.mul(100);
    const DEBT_TO_SET = PRECISION_COLL.mul(150);
    const CAP_TO_SET = PRECISION_COLL.mul(50);
    const TOTAL_DEBT_TO_SET = PRECISION_AUR.mul(150);
    const TOTAL_CAP_TO_SET = PRECISION_AUR.mul(150);

    beforeEach(async function () {
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        CAP_TO_SET,
        0
      );

      await vaultEngine.setTotalDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalCapital(TOTAL_CAP_TO_SET);
      await vaultEngine.updateCollateralType(
        flrCollId,
        0,
        DEBT_TO_SET,
        CAP_TO_SET,
        0,
        0
      );

      await shutdown.initiateShutdown();
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);
      await vaultEngine.initCollType(flrCollId);
      await shutdown.setFinalPrice(flrCollId);

      await increaseTime(172800);
      await increaseTime(172800);
    });

    it("fails if reservePool unBacked Aurei is not zero", async () => {
      await shutdown.setFinalDebtBalance();
      await vaultEngine.setUnbackedAurei(reservePool.address, PRECISION_AUR);
      await assertRevert(
        shutdown.calculateRedeemRatio(flrCollId),
        "shutdown/calculateRedeemRatio: unBacked Aurei of reservePool is not zero"
      );
      await vaultEngine.setUnbackedAurei(reservePool.address, 0);
      await shutdown.calculateRedeemRatio(flrCollId);
    });

    it("tests that redeemRatio calculated correctly when gap is 0", async () => {
      let expected = PRECISION_PRICE;

      await shutdown.setFinalDebtBalance();
      await shutdown.calculateRedeemRatio(flrCollId);

      const collType = await shutdown.collateralTypes(flrCollId);
      expect(collType.redeemRatio).to.equal(expected);
    });

    it("tests that redeemRatio calculated correctly when gap is non zero", async () => {
      await shutdown.setFinalDebtBalance();
      await shutdown.processUserDebt(flrCollId, user.address);
      let expected = PRECISION_PRICE.mul(2).div(3);

      await shutdown.calculateRedeemRatio(flrCollId);

      const collType = await shutdown.collateralTypes(flrCollId);
      expect(collType.redeemRatio).to.equal(expected);
    });

    it("fails if finalDebtBalance is not set", async () => {
      await assertRevert(
        shutdown.calculateRedeemRatio(flrCollId),
        "shutdown/calculateRedeemRatio: must set final debt balance first"
      );
      await shutdown.setFinalDebtBalance();

      await shutdown.calculateRedeemRatio(flrCollId);
    });
  });

  describe("returnAurei Unit Tests", function () {
    const AUREI_AMOUNT_TO_SET = PRECISION_AUR.mul(2000);
    beforeEach(async function () {
      await vaultEngine.setAurei(owner.address, AUREI_AMOUNT_TO_SET);
    });

    it("tests that correct amount of aurei are transferred", async () => {
      const AMOUNT_TO_RETURN = AUREI_AMOUNT_TO_SET.div(10);
      const aureiBalanceBefore = await vaultEngine.aur(shutdown.address);

      await shutdown.returnAurei(AMOUNT_TO_RETURN);

      const aureiBalanceAfter = await vaultEngine.aur(shutdown.address);
      expect(aureiBalanceAfter.sub(aureiBalanceBefore)).to.equal(
        AMOUNT_TO_RETURN
      );
    });

    it("tests that values are properly updated", async () => {
      const AMOUNT_TO_RETURN = AUREI_AMOUNT_TO_SET.div(10);
      const aureiBalanceBefore = await shutdown.aur(owner.address);

      await shutdown.returnAurei(AMOUNT_TO_RETURN);

      const aureiBalanceAfter = await shutdown.aur(owner.address);
      expect(aureiBalanceAfter.sub(aureiBalanceBefore)).to.equal(
        AMOUNT_TO_RETURN
      );
    });
  });

  describe("redeemCollateral Unit Tests", function () {
    const PRICE_TO_SET = PRECISION_PRICE.mul(1);
    const COLL_TO_SET = PRECISION_COLL.mul(100);
    const DEBT_TO_SET = PRECISION_COLL.mul(150);
    const CAP_TO_SET = PRECISION_COLL.mul(50);
    const TOTAL_DEBT_TO_SET = PRECISION_AUR.mul(150);
    const TOTAL_CAP_TO_SET = PRECISION_AUR.mul(150);
    const AUREI_AMOUNT_TO_SET = TOTAL_DEBT_TO_SET;

    beforeEach(async function () {
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        COLL_TO_SET,
        DEBT_TO_SET,
        0,
        0
      );
      await vaultEngine.updateVault(
        flrCollId,
        owner.address,
        0,
        COLL_TO_SET,
        0,
        CAP_TO_SET,
        0
      );

      await vaultEngine.setTotalDebt(TOTAL_DEBT_TO_SET);
      await vaultEngine.setTotalCapital(TOTAL_CAP_TO_SET);
      await vaultEngine.updateCollateralType(
        flrCollId,
        0,
        DEBT_TO_SET,
        CAP_TO_SET,
        0,
        0
      );

      await shutdown.initiateShutdown();
      await priceFeed.setPrice(flrCollId, PRICE_TO_SET);
      await vaultEngine.initCollType(flrCollId);
      await shutdown.setFinalPrice(flrCollId);

      await increaseTime(172800);
      await increaseTime(172800);
      await shutdown.setFinalDebtBalance();
      await shutdown.calculateRedeemRatio(flrCollId);

      await vaultEngine.setAurei(owner.address, AUREI_AMOUNT_TO_SET);
      await vaultEngine.updateVault(
        flrCollId,
        shutdown.address,
        DEBT_TO_SET,
        0,
        0,
        0,
        0
      );
    });

    it("tests that values are properly updated", async () => {
      await shutdown.returnAurei(AUREI_AMOUNT_TO_SET);

      const before = await shutdown.collRedeemed(flrCollId, owner.address);
      await shutdown.redeemCollateral(flrCollId);
      const after = await shutdown.collRedeemed(flrCollId, owner.address);
      expect(after.sub(before)).to.equal(DEBT_TO_SET);
    });

    it("tests that if more aurei is returned, more collateral can be withdrawn", async () => {
      await shutdown.returnAurei(AUREI_AMOUNT_TO_SET.mul(2).div(3));

      let before = await shutdown.collRedeemed(flrCollId, owner.address);

      await shutdown.redeemCollateral(flrCollId);

      let after = await shutdown.collRedeemed(flrCollId, owner.address);
      expect(after.sub(before)).to.equal(DEBT_TO_SET.mul(2).div(3));

      await shutdown.returnAurei(AUREI_AMOUNT_TO_SET.div(3));
      before = await shutdown.collRedeemed(flrCollId, owner.address);

      await shutdown.redeemCollateral(flrCollId);

      after = await shutdown.collRedeemed(flrCollId, owner.address);
      expect(after.sub(before)).to.equal(DEBT_TO_SET.div(3));
    });

    it("tests that correct Amount of collateral has been transferred", async () => {
      await shutdown.returnAurei(AUREI_AMOUNT_TO_SET);

      const before = await vaultEngine.vaults(flrCollId, owner.address);
      await shutdown.redeemCollateral(flrCollId);
      const after = await vaultEngine.vaults(flrCollId, owner.address);

      expect(after.freeCollateral.sub(before.freeCollateral)).to.equal(
        DEBT_TO_SET
      );
    });
  });

  describe("redeemIou Unit Tests", function () {
    const TOTAL_DEBT_TO_SET = PRECISION_AUR.mul(150);

    beforeEach(async function () {
      await shutdown.initiateShutdown();

      await vaultEngine.setTotalDebt(TOTAL_DEBT_TO_SET);
      await increaseTime(172800 * 2);
      await increaseTime(172800);
      await shutdown.setFinalDebtBalance();
      await reservePool.setTotalIous(PRECISION_AUR);
      await vaultEngine.setAurei(reservePool.address, PRECISION_AUR.mul(1000));
    });

    it("fails if finalTotalReserve is not set", async () => {
      await reservePool.setIous(owner.address, PRECISION_AUR);
      await assertRevert(
        shutdown.redeemIou(),
        "shutdown/redeemIou: finalTotalReserve must be set first"
      );
      await shutdown.setFinalSystemReserve();

      await shutdown.redeemIou();
    });

    it("fails if user's IOU balance is zero", async () => {
      await shutdown.setFinalSystemReserve();

      await assertRevert(
        shutdown.redeemIou(),
        "shutdown/redeemIou: no iou to redeem"
      );
      await reservePool.setIous(owner.address, PRECISION_AUR);
      await shutdown.redeemIou();
    });

    it("fails if total IOU balance is zero", async () => {
      await shutdown.setFinalSystemReserve();
      await reservePool.setIous(owner.address, PRECISION_AUR);
      await reservePool.setTotalIous(0);

      await assertRevert(
        shutdown.redeemIou(),
        "shutdown/redeemIou: no iou to redeem"
      );
      await reservePool.setTotalIous(PRECISION_AUR);
      await shutdown.redeemIou();
    });

    it("fails if system reserve aurei balance is zero", async () => {
      await shutdown.setFinalSystemReserve();
      await reservePool.setIous(owner.address, PRECISION_AUR);
      await reservePool.setTotalIous(PRECISION_AUR);

      await assertRevert(
        shutdown.redeemIou(),
        "shutdown/redeemIou: no aur to redeem"
      );
      await vaultEngine.setAurei(reservePool.address, PRECISION_AUR.mul(1000));
      await shutdown.redeemIou();
    });

    it("tests that shutdownRedemption is called with correct parameter", async () => {
      const TOTAL_IOU = PRECISION_AUR.mul(382);
      const USER_IOU = PRECISION_AUR.mul(28);
      const finalTotalReserve = PRECISION_AUR.mul(100);

      await vaultEngine.setAurei(reservePool.address, finalTotalReserve);
      await shutdown.setFinalSystemReserve();

      const EXPECTED_AMOUNT = rmul(
        rdiv(USER_IOU, TOTAL_IOU),
        finalTotalReserve
      );
      await reservePool.setIous(owner.address, USER_IOU);
      await reservePool.setTotalIous(TOTAL_IOU);

      await shutdown.redeemIou();

      const lastCall = await reservePool.lastRedemptionCall();
      expect(lastCall.user).to.equal(owner.address);
      expect(lastCall.amount).to.equal(EXPECTED_AMOUNT);
    });
  });
});
