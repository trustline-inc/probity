import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { BondIssuer, MockVaultEngine, Registry } from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, ADDRESS_ZERO, RAY } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let reservePool: SignerWithAddress;

// Contracts
let vaultEngine: MockVaultEngine;
let registry: Registry;
let bondIssuer: BondIssuer;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("BondIssuer Unit Tests", function () {
  const DEFAULT_SALE_STEP_PERIOD = 21600;
  const DEFAULT_PER_STEP_INCREASE = WAD.mul(5).div(100);

  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;

    contracts = await probity.deployBondIssuer({
      vaultEngine: contracts.mockVaultEngine?.address,
    });
    vaultEngine = contracts.mockVaultEngine!;
    bondIssuer = contracts.bondIssuer!;

    owner = signers.owner!;
    user = signers.alice!;
    gov = signers.charlie!;
    reservePool = signers.don!;

    await bondIssuer.setReservePoolAddress(reservePool.address);
    await registry.setupAddress(bytes32("gov"), gov.address, true);
    await registry.setupAddress(
      bytes32("reservePool"),
      reservePool.address,
      true
    );
  });

  describe("tokensPerSystemCurrency Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(500000);
    beforeEach(async function () {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
    });

    it("tests that price increase correctly at each steps", async () => {
      const EXPECTED_INITIAL = WAD;
      const initialStep = await bondIssuer.tokensPerSystemCurrency();
      expect(initialStep).to.equal(EXPECTED_INITIAL);

      await increaseTime(DEFAULT_SALE_STEP_PERIOD);
      const secondStep = await bondIssuer.tokensPerSystemCurrency();
      expect(secondStep).to.equal(
        EXPECTED_INITIAL.add(DEFAULT_PER_STEP_INCREASE)
      );

      await increaseTime(DEFAULT_SALE_STEP_PERIOD);
      const thirdStep = await bondIssuer.tokensPerSystemCurrency();
      expect(thirdStep).to.equal(
        EXPECTED_INITIAL.add(DEFAULT_PER_STEP_INCREASE).add(
          DEFAULT_PER_STEP_INCREASE
        )
      );
    });

    it("tests that it doesn't go over max values", async () => {
      const EXPECTED_INITIAL = WAD;
      const EXPECTED_MAX = WAD.mul(15).div(10);

      const initialStep = await bondIssuer.tokensPerSystemCurrency();
      expect(initialStep).to.equal(EXPECTED_INITIAL);

      await increaseTime(DEFAULT_SALE_STEP_PERIOD * 20);
      const nextStep = await bondIssuer.tokensPerSystemCurrency();
      expect(nextStep).to.equal(EXPECTED_MAX);
    });
  });

  describe("setReservePoolAddress Unit Tests", function () {
    beforeEach(async function () {
      let { contracts } = await deployTest();

      contracts = await probity.deployBondIssuer({
        vaultEngine: contracts.mockVaultEngine?.address,
      });
      registry = contracts.registry!;
      bondIssuer = contracts.bondIssuer!;

      await registry.setupAddress(bytes32("gov"), gov.address, true);
    });
    it("fails if caller is not 'gov'", async () => {
      await assertRevert(
        bondIssuer.connect(user).setReservePoolAddress(reservePool.address),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await bondIssuer.connect(user).setReservePoolAddress(reservePool.address);
    });

    it("fails if reservePoolAddress has already been set", async () => {
      await bondIssuer.connect(gov).setReservePoolAddress(reservePool.address);
      await assertRevert(
        bondIssuer.connect(gov).setReservePoolAddress(reservePool.address),
        "reservePoolAlreadySet()"
      );
    });

    it("tests that values are properly set", async () => {
      const before = await bondIssuer.reservePoolAddress();
      expect(before).to.equal(ADDRESS_ZERO);
      await bondIssuer.connect(gov).setReservePoolAddress(reservePool.address);
      const after = await bondIssuer.reservePoolAddress();
      expect(after).to.equal(reservePool.address);
    });
  });

  describe("updateMaxDiscount Unit Tests", function () {
    const DEFAULT_MAX_PRICE = WAD.mul(15).div(10);
    const NEW_MAX_PRICE = WAD.mul(2);
    it("fails if caller is not 'gov'", async () => {
      await assertRevert(
        bondIssuer.connect(user).updateMaxDiscount(NEW_MAX_PRICE),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await bondIssuer.connect(user).updateMaxDiscount(NEW_MAX_PRICE);
    });

    it("tests that values are properly set", async () => {
      const before = await bondIssuer.maxDiscount();
      expect(before).to.equal(DEFAULT_MAX_PRICE);
      await bondIssuer.connect(gov).updateMaxDiscount(NEW_MAX_PRICE);
      const after = await bondIssuer.maxDiscount();
      expect(after).to.equal(NEW_MAX_PRICE);
    });
  });

  describe("updateStepPeriod Unit Tests", function () {
    const NEW_STEP_PERIOD = DEFAULT_SALE_STEP_PERIOD / 2;
    it("fails if caller is not gov", async () => {
      await assertRevert(
        bondIssuer.connect(user).updateStepPeriod(NEW_STEP_PERIOD),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await bondIssuer.connect(user).updateStepPeriod(NEW_STEP_PERIOD);
    });

    it("tests that values are properly set", async () => {
      const before = await bondIssuer.stepPeriod();
      expect(before).to.equal(DEFAULT_SALE_STEP_PERIOD);
      await bondIssuer.connect(gov).updateStepPeriod(NEW_STEP_PERIOD);
      const after = await bondIssuer.stepPeriod();
      expect(after).to.equal(NEW_STEP_PERIOD);
    });
  });

  describe("updateDiscountIncreasePerStep Unit Tests", function () {
    const NEW_PRICE_INCREASE_PER_STEP = DEFAULT_PER_STEP_INCREASE.div(2);
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        bondIssuer
          .connect(user)
          .updateDiscountIncreasePerStep(NEW_PRICE_INCREASE_PER_STEP),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await bondIssuer
        .connect(user)
        .updateDiscountIncreasePerStep(NEW_PRICE_INCREASE_PER_STEP);
    });

    it("tests that values are properly set", async () => {
      const before = await bondIssuer.discountIncreasePerStep();
      expect(before).to.equal(DEFAULT_PER_STEP_INCREASE);
      await bondIssuer
        .connect(gov)
        .updateDiscountIncreasePerStep(NEW_PRICE_INCREASE_PER_STEP);
      const after = await bondIssuer.discountIncreasePerStep();
      expect(after).to.equal(NEW_PRICE_INCREASE_PER_STEP);
    });
  });

  describe("newOffering Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(387762);
    it("fails if caller is not by reservePool", async () => {
      await assertRevert(
        bondIssuer.connect(user).newOffering(OFFER_AMOUNT),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.setupAddress(bytes32("reservePool"), user.address, true);
      await bondIssuer.connect(user).newOffering(OFFER_AMOUNT);
    });

    it("fails if current Offering is not over yet", async () => {
      await registry.setupAddress(bytes32("reservePool"), user.address, true);
      await bondIssuer.connect(user).newOffering(OFFER_AMOUNT);
      await assertRevert(
        bondIssuer.connect(user).newOffering(OFFER_AMOUNT),
        "saleActive()"
      );
    });

    it("tests that values are properly set", async () => {
      await registry.setupAddress(bytes32("reservePool"), user.address, true);

      const before = await bondIssuer.offering();
      expect(before.active).to.equal(false);
      expect(before.startTime).to.equal(0);
      expect(before.amount).to.equal(0);

      await bondIssuer.connect(user).newOffering(OFFER_AMOUNT);

      const after = await bondIssuer.offering();
      expect(after.active).to.equal(true);
      expect(after.startTime.gt(0)).to.equal(true);
      expect(after.amount).to.equal(OFFER_AMOUNT);
    });
  });

  describe("purchaseBond Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const STABLECOIN_BAL = RAD.mul(1000000);

    beforeEach(async function () {
      await vaultEngine.setSystemCurrency(owner.address, STABLECOIN_BAL);
    });

    it("fails if offering is not active", async () => {
      await assertRevert(
        bondIssuer.purchaseBond(OFFER_AMOUNT.div(2)),
        "saleNotActive()"
      );
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await bondIssuer.purchaseBond(OFFER_AMOUNT.div(2));
    });

    it("fails if purchase amount is higher than offering amount", async () => {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);

      await assertRevert(
        bondIssuer.purchaseBond(OFFER_AMOUNT.add(1)),
        "purchaseAmountIsHigherThanAvailable"
      );
      await bondIssuer.purchaseBond(OFFER_AMOUNT);
    });

    it("fails when contract is in paused state", async () => {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await bondIssuer.connect(gov).setState(bytes32("paused"), true);
      await assertRevert(
        bondIssuer.purchaseBond(OFFER_AMOUNT),
        "stateCheckFailed"
      );

      await bondIssuer.connect(gov).setState(bytes32("paused"), false);
      await bondIssuer.purchaseBond(OFFER_AMOUNT);
    });

    it("tests that correct amount of systemCurrency are transferred", async () => {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      const before = await vaultEngine.systemCurrency(owner.address);
      await bondIssuer.purchaseBond(OFFER_AMOUNT);
      const after = await vaultEngine.systemCurrency(owner.address);

      expect(after.sub(before).abs()).to.equal(OFFER_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const BUY_AMOUNT = OFFER_AMOUNT.div(2);
      const EXPECTED_VOUCHERS = BUY_AMOUNT.mul(
        WAD.add(DEFAULT_PER_STEP_INCREASE.mul(2))
      ).div(WAD);
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await increaseTime(DEFAULT_SALE_STEP_PERIOD * 2);

      const price = await bondIssuer.tokensPerSystemCurrency();
      expect(price).to.equal(WAD.add(DEFAULT_PER_STEP_INCREASE.mul(2)));

      const offeringBefore = await bondIssuer.offering();
      const tokensBefore = await bondIssuer.bondTokens(owner.address);
      const totalBondTokensBefore = await bondIssuer.totalBondTokens();

      await bondIssuer.purchaseBond(BUY_AMOUNT);

      const totalBondTokensAfter = await bondIssuer.totalBondTokens();
      const tokensAfter = await bondIssuer.bondTokens(owner.address);
      const offeringAfter = await bondIssuer.offering();

      expect(offeringAfter.active).to.equal(true);
      expect(offeringAfter.amount.sub(offeringBefore.amount).abs()).to.equal(
        BUY_AMOUNT
      );
      expect(tokensAfter.sub(tokensBefore).abs()).to.equal(EXPECTED_VOUCHERS);
      expect(totalBondTokensAfter.sub(totalBondTokensBefore).abs()).to.equal(
        EXPECTED_VOUCHERS
      );
    });

    it("tests that offering is no longer active if amount became zero", async () => {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);

      const before = await bondIssuer.offering();
      expect(before.active).to.equal(true);

      await bondIssuer.purchaseBond(OFFER_AMOUNT);

      const after = await bondIssuer.offering();
      expect(after.active).to.equal(false);
    });
  });

  describe("redeemBondTokens Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const RESERVE_BAL = RAD.mul(10000000);
    const BUY_AMOUNT = OFFER_AMOUNT.div(10);
    beforeEach(async function () {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await vaultEngine.setSystemCurrency(reservePool.address, RESERVE_BAL);
      await vaultEngine.setSystemCurrency(owner.address, RESERVE_BAL);
      await vaultEngine.setSystemCurrency(user.address, RESERVE_BAL);

      await bondIssuer.purchaseBond(BUY_AMOUNT);
    });

    it("fails if reservePool doesn't have enough funds to redeem", async () => {
      await vaultEngine.setSystemCurrency(reservePool.address, 0);
      await assertRevert(
        bondIssuer.redeemBondTokens(BUY_AMOUNT),
        "insufficientFundsInReservePool"
      );
      await vaultEngine.setSystemCurrency(reservePool.address, RESERVE_BAL);
      await bondIssuer.redeemBondTokens(BUY_AMOUNT);
    });

    it("fails if user doesn't have enough tokens to redeem", async () => {
      await assertRevert(
        bondIssuer.connect(user).redeemBondTokens(BUY_AMOUNT),
        "notEnoughBondsToRedeem"
      );
      await bondIssuer.connect(user).purchaseBond(BUY_AMOUNT);
      await bondIssuer.connect(user).redeemBondTokens(BUY_AMOUNT);
    });

    it("fails when contract is in paused state", async () => {
      await bondIssuer.connect(user).purchaseBond(BUY_AMOUNT);

      await bondIssuer.connect(gov).setState(bytes32("paused"), true);
      await assertRevert(
        bondIssuer.connect(user).redeemBondTokens(BUY_AMOUNT),
        "stateCheckFailed"
      );

      await bondIssuer.connect(gov).setState(bytes32("paused"), false);
      await bondIssuer.connect(user).redeemBondTokens(BUY_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const before = await bondIssuer.bondTokens(owner.address);
      await bondIssuer.redeemBondTokens(BUY_AMOUNT);
      const after = await bondIssuer.bondTokens(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });

    it("tests that correct amount of systemCurrency is transferred", async () => {
      const before = await vaultEngine.systemCurrency(owner.address);
      await bondIssuer.redeemBondTokens(BUY_AMOUNT);
      const after = await vaultEngine.systemCurrency(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });
  });

  describe("redeemBondTokensForUser Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const RESERVE_BAL = RAD.mul(10000000);
    const BUY_AMOUNT = OFFER_AMOUNT.div(10);
    beforeEach(async function () {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await vaultEngine.setSystemCurrency(reservePool.address, RESERVE_BAL);
      await vaultEngine.setSystemCurrency(owner.address, RESERVE_BAL);
      await vaultEngine.setSystemCurrency(user.address, RESERVE_BAL);

      await bondIssuer.purchaseBond(BUY_AMOUNT);
    });

    it("fails if reservePool doesn't have enough funds to redeem", async () => {
      await vaultEngine.setSystemCurrency(reservePool.address, 0);
      await assertRevert(
        bondIssuer
          .connect(gov)
          .redeemBondTokensForUser(owner.address, BUY_AMOUNT),
        "insufficientFundsInReservePool"
      );
      await vaultEngine.setSystemCurrency(reservePool.address, RESERVE_BAL);
      await bondIssuer
        .connect(gov)
        .redeemBondTokensForUser(owner.address, BUY_AMOUNT);
    });

    it("fails if user doesn't have enough tokens to redeem", async () => {
      await assertRevert(
        bondIssuer
          .connect(gov)
          .redeemBondTokensForUser(user.address, BUY_AMOUNT),
        "notEnoughBondsToRedeem"
      );
      await bondIssuer.connect(user).purchaseBond(BUY_AMOUNT);
      await bondIssuer
        .connect(gov)
        .redeemBondTokensForUser(user.address, BUY_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const before = await bondIssuer.bondTokens(owner.address);
      await bondIssuer
        .connect(gov)
        .redeemBondTokensForUser(owner.address, BUY_AMOUNT);
      const after = await bondIssuer.bondTokens(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });

    it("tests that correct amount of systemCurrency is transferred", async () => {
      const before = await vaultEngine.systemCurrency(owner.address);
      await bondIssuer
        .connect(gov)
        .redeemBondTokensForUser(owner.address, BUY_AMOUNT);
      const after = await vaultEngine.systemCurrency(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });
  });
});
