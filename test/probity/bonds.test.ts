import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Bonds, MockVaultEngine, Registry, Teller } from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY, ADDRESS_ZERO } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
import { rmul, rpow, wdiv } from "../utils/math";
import exp = require("constants");
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let reservePool: SignerWithAddress;
let shutdown: SignerWithAddress;

// Contracts
let vaultEngine: MockVaultEngine;
let registry: Registry;
let bonds: Bonds;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Bonds Unit Tests", function () {
  const DEFAULT_SALE_STEP_PERIOD = 21600;
  const DEFAULT_PER_STEP_INCREASE = WAD.mul(5).div(100);

  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;

    contracts = await probity.deployBonds({
      vaultEngine: contracts.mockVaultEngine.address,
    });
    vaultEngine = contracts.mockVaultEngine;
    bonds = contracts.bonds;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    reservePool = signers.don;
    shutdown = signers.bob;

    await bonds.setReservePoolAddress(reservePool.address);
    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry.setupAddress(bytes32("reservePool"), reservePool.address);
    await registry.setupAddress(bytes32("shutdown"), shutdown.address);
  });

  describe("vouchersPerStablecoin Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(500000);
    beforeEach(async function () {
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);
    });

    it("tests that price increase correctly at each steps", async () => {
      const EXPECTED_INITIAL = WAD;
      const initialStep = await bonds.vouchersPerStablecoin();
      expect(initialStep).to.equal(EXPECTED_INITIAL);

      await increaseTime(DEFAULT_SALE_STEP_PERIOD);
      const secondStep = await bonds.vouchersPerStablecoin();
      expect(secondStep).to.equal(
        EXPECTED_INITIAL.add(DEFAULT_PER_STEP_INCREASE)
      );

      await increaseTime(DEFAULT_SALE_STEP_PERIOD);
      const thirdStep = await bonds.vouchersPerStablecoin();
      expect(thirdStep).to.equal(
        EXPECTED_INITIAL.add(DEFAULT_PER_STEP_INCREASE).add(
          DEFAULT_PER_STEP_INCREASE
        )
      );
    });

    it("tests that it doesn't go over max values", async () => {
      const EXPECTED_INITIAL = WAD;
      const EXPECTED_MAX = WAD.mul(15).div(10);

      const initialStep = await bonds.vouchersPerStablecoin();
      expect(initialStep).to.equal(EXPECTED_INITIAL);

      await increaseTime(DEFAULT_SALE_STEP_PERIOD * 20);
      const nextStep = await bonds.vouchersPerStablecoin();
      expect(nextStep).to.equal(EXPECTED_MAX);
    });
  });

  describe("setReservePoolAddress Unit Tests", function () {
    beforeEach(async function () {
      let { contracts } = await deployTest();

      contracts = await probity.deployBonds({
        vaultEngine: contracts.mockVaultEngine.address,
      });
      registry = contracts.registry;
      bonds = contracts.bonds;

      await registry.setupAddress(bytes32("gov"), gov.address);
    });
    it("fails if caller is not 'gov'", async () => {
      await assertRevert(
        bonds.connect(user).setReservePoolAddress(reservePool.address),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await bonds.connect(user).setReservePoolAddress(reservePool.address);
    });

    it("fails if reservePoolAddress has already been set", async () => {
      await bonds.connect(gov).setReservePoolAddress(reservePool.address);
      await assertRevert(
        bonds.connect(gov).setReservePoolAddress(reservePool.address),
        "Bonds/setReservePoolAddress: reservePool Address already set"
      );
    });

    it("tests that values are properly set", async () => {
      const before = await bonds.reservePoolAddress();
      expect(before).to.equal(ADDRESS_ZERO);
      await bonds.connect(gov).setReservePoolAddress(reservePool.address);
      const after = await bonds.reservePoolAddress();
      expect(after).to.equal(reservePool.address);
    });
  });

  describe("updateSaleMaxPrice Unit Tests", function () {
    const DEFAULT_MAX_PRICE = WAD.mul(15).div(10);
    const NEW_MAX_PRICE = WAD.mul(2);
    it("fails if caller is not 'gov'", async () => {
      await assertRevert(
        bonds.connect(user).updateSaleMaxPrice(NEW_MAX_PRICE),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await bonds.connect(user).updateSaleMaxPrice(NEW_MAX_PRICE);
    });

    it("tests that values are properly set", async () => {
      const before = await bonds.saleMaxPrice();
      expect(before).to.equal(DEFAULT_MAX_PRICE);
      await bonds.connect(gov).updateSaleMaxPrice(NEW_MAX_PRICE);
      const after = await bonds.saleMaxPrice();
      expect(after).to.equal(NEW_MAX_PRICE);
    });
  });

  describe("updateSaleStepPeriod Unit Tests", function () {
    const NEW_STEP_PERIOD = DEFAULT_SALE_STEP_PERIOD / 2;
    it("fails if caller is not gov", async () => {
      await assertRevert(
        bonds.connect(user).updateSaleStepPeriod(NEW_STEP_PERIOD),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await bonds.connect(user).updateSaleStepPeriod(NEW_STEP_PERIOD);
    });

    it("tests that values are properly set", async () => {
      const before = await bonds.saleStepPeriod();
      expect(before).to.equal(DEFAULT_SALE_STEP_PERIOD);
      await bonds.connect(gov).updateSaleStepPeriod(NEW_STEP_PERIOD);
      const after = await bonds.saleStepPeriod();
      expect(after).to.equal(NEW_STEP_PERIOD);
    });
  });

  describe("updateSalePriceIncreasePerStep Unit Tests", function () {
    const NEW_PRICE_INCREASE_PER_STEP = DEFAULT_PER_STEP_INCREASE.div(2);
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        bonds
          .connect(user)
          .updateSalePriceIncreasePerStep(NEW_PRICE_INCREASE_PER_STEP),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await bonds
        .connect(user)
        .updateSalePriceIncreasePerStep(NEW_PRICE_INCREASE_PER_STEP);
    });

    it("tests that values are properly set", async () => {
      const before = await bonds.salePriceIncreasePerStep();
      expect(before).to.equal(DEFAULT_PER_STEP_INCREASE);
      await bonds
        .connect(gov)
        .updateSalePriceIncreasePerStep(NEW_PRICE_INCREASE_PER_STEP);
      const after = await bonds.salePriceIncreasePerStep();
      expect(after).to.equal(NEW_PRICE_INCREASE_PER_STEP);
    });
  });

  describe("newOffering Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(387762);
    it("fails if caller is not by reservePool", async () => {
      await assertRevert(
        bonds.connect(user).newOffering(OFFER_AMOUNT),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("reservePool"), user.address);
      await bonds.connect(user).newOffering(OFFER_AMOUNT);
    });

    it("fails if current Offering is not over yet", async () => {
      await registry.setupAddress(bytes32("reservePool"), user.address);
      await bonds.connect(user).newOffering(OFFER_AMOUNT);
      await assertRevert(
        bonds.connect(user).newOffering(OFFER_AMOUNT),
        "ReservePool/startSale: the current offering is not over yet"
      );
    });

    it("tests that values are properly set", async () => {
      await registry.setupAddress(bytes32("reservePool"), user.address);

      const before = await bonds.offering();
      expect(before.active).to.equal(false);
      expect(before.startTime).to.equal(0);
      expect(before.amount).to.equal(0);

      await bonds.connect(user).newOffering(OFFER_AMOUNT);

      const after = await bonds.offering();
      expect(after.active).to.equal(true);
      expect(after.startTime.gt(0)).to.equal(true);
      expect(after.amount).to.equal(OFFER_AMOUNT);
    });
  });

  describe("shutdownRedemption Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const RESERVE_BAL = RAD.mul(10000000);
    const BUY_AMOUNT = OFFER_AMOUNT.div(10);

    beforeEach(async function () {
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(owner.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(user.address, RESERVE_BAL);

      await bonds.purchaseVouchers(BUY_AMOUNT);
    });

    it("fails if not in shutdown state", async () => {
      await assertRevert(
        bonds.connect(shutdown).shutdownRedemption(owner.address, BUY_AMOUNT),
        "Stateful/onlyWhen: State check failed"
      );
      await bonds.connect(shutdown).setShutdownState();
      await bonds
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("fails if not called by shutdown", async () => {
      await bonds.connect(shutdown).setShutdownState();

      await assertRevert(
        bonds.connect(user).shutdownRedemption(owner.address, BUY_AMOUNT),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("shutdown"), user.address);
      await bonds.connect(user).shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("fails if reservePool doesn't have enough funds to redeem", async () => {
      await bonds.connect(shutdown).setShutdownState();

      await vaultEngine.setStablecoin(reservePool.address, 0);
      await assertRevert(
        bonds.connect(shutdown).shutdownRedemption(owner.address, BUY_AMOUNT),
        "ReservePool/processRedemption: The reserve pool doesn't have enough funds"
      );
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await bonds
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("fails if user doesn't have enough vouchers to redeem", async () => {
      await bonds.connect(shutdown).setShutdownState();

      await assertRevert(
        bonds.connect(shutdown).shutdownRedemption(user.address, BUY_AMOUNT),
        "ReservePool/processRedemption: User doesn't have enough vouchers to redeem this amount"
      );
      await bonds
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      await bonds.connect(shutdown).setShutdownState();

      const before = await bonds.vouchers(owner.address);
      await bonds
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
      const after = await bonds.vouchers(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });

    it("tests that correct amount of stablecoin is transferred", async () => {
      await bonds.connect(shutdown).setShutdownState();

      const before = await vaultEngine.stablecoin(owner.address);
      await bonds
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
      const after = await vaultEngine.stablecoin(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });
  });

  describe("purchaseVouchers Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const STABLECOIN_BAL = RAD.mul(1000000);

    beforeEach(async function () {
      await vaultEngine.setStablecoin(owner.address, STABLECOIN_BAL);
    });

    it("fails if offering is not active", async () => {
      await assertRevert(
        bonds.purchaseVouchers(OFFER_AMOUNT.div(2)),
        "ReservePool/purchaseVouchers: vouchers are not currently on sale"
      );
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);
      await bonds.purchaseVouchers(OFFER_AMOUNT.div(2));
    });

    it("fails if purchase amount is higher than offering amount", async () => {
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);

      await assertRevert(
        bonds.purchaseVouchers(OFFER_AMOUNT.add(1)),
        "ReservePool/purchaseVouchers: Can't purchase more vouchers than amount available"
      );
      await bonds.purchaseVouchers(OFFER_AMOUNT);
    });

    it("tests that correct amount of stablecoins are transferred", async () => {
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);
      const before = await vaultEngine.stablecoin(owner.address);
      await bonds.purchaseVouchers(OFFER_AMOUNT);
      const after = await vaultEngine.stablecoin(owner.address);

      expect(after.sub(before).abs()).to.equal(OFFER_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const BUY_AMOUNT = OFFER_AMOUNT.div(2);
      const EXPECTED_VOUCHERS = BUY_AMOUNT.mul(
        WAD.add(DEFAULT_PER_STEP_INCREASE.mul(2))
      ).div(WAD);
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);
      await increaseTime(DEFAULT_SALE_STEP_PERIOD * 2);

      const price = await bonds.vouchersPerStablecoin();
      expect(price).to.equal(WAD.add(DEFAULT_PER_STEP_INCREASE.mul(2)));

      const offeringBefore = await bonds.offering();
      const vouchersBefore = await bonds.vouchers(owner.address);
      const totalVouchersBefore = await bonds.totalVouchers();

      await bonds.purchaseVouchers(BUY_AMOUNT);

      const totalVouchersAfter = await bonds.totalVouchers();
      const vouchersAfter = await bonds.vouchers(owner.address);
      const offeringAfter = await bonds.offering();

      expect(offeringAfter.active).to.equal(true);
      expect(offeringAfter.amount.sub(offeringBefore.amount).abs()).to.equal(
        BUY_AMOUNT
      );
      expect(vouchersAfter.sub(vouchersBefore).abs()).to.equal(
        EXPECTED_VOUCHERS
      );
      expect(totalVouchersAfter.sub(totalVouchersBefore).abs()).to.equal(
        EXPECTED_VOUCHERS
      );
    });

    it("tests that offering is no longer active if amount became zero", async () => {
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);

      const before = await bonds.offering();
      expect(before.active).to.equal(true);

      await bonds.purchaseVouchers(OFFER_AMOUNT);

      const after = await bonds.offering();
      expect(after.active).to.equal(false);
    });
  });

  describe("redeemVouchers Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const RESERVE_BAL = RAD.mul(10000000);
    const BUY_AMOUNT = OFFER_AMOUNT.div(10);
    beforeEach(async function () {
      await bonds.connect(reservePool).newOffering(OFFER_AMOUNT);
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(owner.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(user.address, RESERVE_BAL);

      await bonds.purchaseVouchers(BUY_AMOUNT);
    });

    it("fails if reservePool doesn't have enough funds to redeem", async () => {
      await vaultEngine.setStablecoin(reservePool.address, 0);
      await assertRevert(
        bonds.redeemVouchers(BUY_AMOUNT),
        "ReservePool/processRedemption: The reserve pool doesn't have enough funds"
      );
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await bonds.redeemVouchers(BUY_AMOUNT);
    });

    it("fails if user doesn't have enough vouchers to redeem", async () => {
      await assertRevert(
        bonds.connect(user).redeemVouchers(BUY_AMOUNT),
        "ReservePool/processRedemption: User doesn't have enough vouchers to redeem this amount"
      );
      await bonds.connect(user).purchaseVouchers(BUY_AMOUNT);
      await bonds.connect(user).redeemVouchers(BUY_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const before = await bonds.vouchers(owner.address);
      await bonds.redeemVouchers(BUY_AMOUNT);
      const after = await bonds.vouchers(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });

    it("tests that correct amount of stablecoin is transferred", async () => {
      const before = await vaultEngine.stablecoin(owner.address);
      await bonds.redeemVouchers(BUY_AMOUNT);
      const after = await vaultEngine.stablecoin(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });
  });
});
