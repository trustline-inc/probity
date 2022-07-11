import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { BondIssuer, MockVaultEngine, Registry } from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, ADDRESS_ZERO } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
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
let bondIssuer: BondIssuer;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("BondIssuer Unit Tests", function () {
  const DEFAULT_SALE_STEP_PERIOD = 21600;
  const DEFAULT_PER_STEP_INCREASE = WAD.mul(5).div(100);

  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;

    contracts = await probity.deployBondIssuer({
      vaultEngine: contracts.mockVaultEngine.address,
    });
    vaultEngine = contracts.mockVaultEngine;
    bondIssuer = contracts.bondIssuer;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    reservePool = signers.don;
    shutdown = signers.bob;

    await bondIssuer.setReservePoolAddress(reservePool.address);
    await registry.setupAddress(bytes32("gov"), gov.address, true);
    await registry.setupAddress(
      bytes32("reservePool"),
      reservePool.address,
      true
    );
    await registry.setupAddress(bytes32("shutdown"), shutdown.address, true);
  });

  describe("tokensPerStablecoin Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(500000);
    beforeEach(async function () {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
    });

    it("tests that price increase correctly at each steps", async () => {
      const EXPECTED_INITIAL = WAD;
      const initialStep = await bondIssuer.tokensPerStablecoin();
      expect(initialStep).to.equal(EXPECTED_INITIAL);

      await increaseTime(DEFAULT_SALE_STEP_PERIOD);
      const secondStep = await bondIssuer.tokensPerStablecoin();
      expect(secondStep).to.equal(
        EXPECTED_INITIAL.add(DEFAULT_PER_STEP_INCREASE)
      );

      await increaseTime(DEFAULT_SALE_STEP_PERIOD);
      const thirdStep = await bondIssuer.tokensPerStablecoin();
      expect(thirdStep).to.equal(
        EXPECTED_INITIAL.add(DEFAULT_PER_STEP_INCREASE).add(
          DEFAULT_PER_STEP_INCREASE
        )
      );
    });

    it("tests that it doesn't go over max values", async () => {
      const EXPECTED_INITIAL = WAD;
      const EXPECTED_MAX = WAD.mul(15).div(10);

      const initialStep = await bondIssuer.tokensPerStablecoin();
      expect(initialStep).to.equal(EXPECTED_INITIAL);

      await increaseTime(DEFAULT_SALE_STEP_PERIOD * 20);
      const nextStep = await bondIssuer.tokensPerStablecoin();
      expect(nextStep).to.equal(EXPECTED_MAX);
    });
  });

  describe("setReservePoolAddress Unit Tests", function () {
    beforeEach(async function () {
      let { contracts } = await deployTest();

      contracts = await probity.deployBondIssuer({
        vaultEngine: contracts.mockVaultEngine.address,
      });
      registry = contracts.registry;
      bondIssuer = contracts.bondIssuer;

      await registry.setupAddress(bytes32("gov"), gov.address, true);
    });
    it("fails if caller is not 'gov'", async () => {
      await assertRevert(
        bondIssuer.connect(user).setReservePoolAddress(reservePool.address),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await bondIssuer.connect(user).setReservePoolAddress(reservePool.address);
    });

    it("fails if reservePoolAddress has already been set", async () => {
      await bondIssuer.connect(gov).setReservePoolAddress(reservePool.address);
      await assertRevert(
        bondIssuer.connect(gov).setReservePoolAddress(reservePool.address),
        "BondIssuer/setReservePoolAddress: reservePool Address already set"
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
        "AccessControl/onlyBy: Caller does not have permission"
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
        "AccessControl/onlyBy: Caller does not have permission"
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
        "AccessControl/onlyBy: Caller does not have permission"
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
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("reservePool"), user.address, true);
      await bondIssuer.connect(user).newOffering(OFFER_AMOUNT);
    });

    it("fails if current Offering is not over yet", async () => {
      await registry.setupAddress(bytes32("reservePool"), user.address, true);
      await bondIssuer.connect(user).newOffering(OFFER_AMOUNT);
      await assertRevert(
        bondIssuer.connect(user).newOffering(OFFER_AMOUNT),
        "ReservePool/startBondSale: the current offering is not over yet"
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

  describe("shutdownRedemption Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const RESERVE_BAL = RAD.mul(10000000);
    const BUY_AMOUNT = OFFER_AMOUNT.div(10);

    beforeEach(async function () {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(owner.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(user.address, RESERVE_BAL);

      await bondIssuer.purchaseBond(BUY_AMOUNT);
    });

    it("fails if not in shutdown state", async () => {
      await assertRevert(
        bondIssuer
          .connect(shutdown)
          .shutdownRedemption(owner.address, BUY_AMOUNT),
        "Stateful/onlyWhen: State check failed"
      );
      await bondIssuer.connect(shutdown).setShutdownState();
      await bondIssuer
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("fails if not called by shutdown", async () => {
      await bondIssuer.connect(shutdown).setShutdownState();

      await assertRevert(
        bondIssuer.connect(user).shutdownRedemption(owner.address, BUY_AMOUNT),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("shutdown"), user.address, true);
      await bondIssuer
        .connect(user)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("fails if reservePool doesn't have enough funds to redeem", async () => {
      await bondIssuer.connect(shutdown).setShutdownState();

      await vaultEngine.setStablecoin(reservePool.address, 0);
      await assertRevert(
        bondIssuer
          .connect(shutdown)
          .shutdownRedemption(owner.address, BUY_AMOUNT),
        "BondIssuer/processRedemption: The reserve pool doesn't have enough funds"
      );
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await bondIssuer
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("fails if user doesn't have enough tokens to redeem", async () => {
      await bondIssuer.connect(shutdown).setShutdownState();

      await assertRevert(
        bondIssuer
          .connect(shutdown)
          .shutdownRedemption(user.address, BUY_AMOUNT),
        "BondIssuer/processRedemption: User doesn't have enough tokens to redeem this amount"
      );
      await bondIssuer
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      await bondIssuer.connect(shutdown).setShutdownState();

      const before = await bondIssuer.tokens(owner.address);
      await bondIssuer
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
      const after = await bondIssuer.tokens(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });

    it("tests that correct amount of stablecoin is transferred", async () => {
      await bondIssuer.connect(shutdown).setShutdownState();

      const before = await vaultEngine.balance(owner.address);
      await bondIssuer
        .connect(shutdown)
        .shutdownRedemption(owner.address, BUY_AMOUNT);
      const after = await vaultEngine.balance(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });
  });

  describe("purchaseBond Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const STABLECOIN_BAL = RAD.mul(1000000);

    beforeEach(async function () {
      await vaultEngine.setStablecoin(owner.address, STABLECOIN_BAL);
    });

    it("fails if offering is not active", async () => {
      await assertRevert(
        bondIssuer.purchaseBond(OFFER_AMOUNT.div(2)),
        "ReservePool/purchaseBond: Bonds are not currently offered for sale"
      );
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await bondIssuer.purchaseBond(OFFER_AMOUNT.div(2));
    });

    it("fails if purchase amount is higher than offering amount", async () => {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);

      await assertRevert(
        bondIssuer.purchaseBond(OFFER_AMOUNT.add(1)),
        "ReservePool/purchaseBond: Can't purchase more bondTokens than offering amount"
      );
      await bondIssuer.purchaseBond(OFFER_AMOUNT);
    });

    it("tests that correct amount of stablecoins are transferred", async () => {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      const before = await vaultEngine.balance(owner.address);
      await bondIssuer.purchaseBond(OFFER_AMOUNT);
      const after = await vaultEngine.balance(owner.address);

      expect(after.sub(before).abs()).to.equal(OFFER_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const BUY_AMOUNT = OFFER_AMOUNT.div(2);
      const EXPECTED_VOUCHERS = BUY_AMOUNT.mul(
        WAD.add(DEFAULT_PER_STEP_INCREASE.mul(2))
      ).div(WAD);
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await increaseTime(DEFAULT_SALE_STEP_PERIOD * 2);

      const price = await bondIssuer.tokensPerStablecoin();
      expect(price).to.equal(WAD.add(DEFAULT_PER_STEP_INCREASE.mul(2)));

      const offeringBefore = await bondIssuer.offering();
      const tokensBefore = await bondIssuer.tokens(owner.address);
      const totalTokensBefore = await bondIssuer.totalTokens();

      await bondIssuer.purchaseBond(BUY_AMOUNT);

      const totalTokensAfter = await bondIssuer.totalTokens();
      const tokensAfter = await bondIssuer.tokens(owner.address);
      const offeringAfter = await bondIssuer.offering();

      expect(offeringAfter.active).to.equal(true);
      expect(offeringAfter.amount.sub(offeringBefore.amount).abs()).to.equal(
        BUY_AMOUNT
      );
      expect(tokensAfter.sub(tokensBefore).abs()).to.equal(EXPECTED_VOUCHERS);
      expect(totalTokensAfter.sub(totalTokensBefore).abs()).to.equal(
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

  describe("redeemTokens Unit Tests", function () {
    const OFFER_AMOUNT = RAD.mul(10000);
    const RESERVE_BAL = RAD.mul(10000000);
    const BUY_AMOUNT = OFFER_AMOUNT.div(10);
    beforeEach(async function () {
      await bondIssuer.connect(reservePool).newOffering(OFFER_AMOUNT);
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(owner.address, RESERVE_BAL);
      await vaultEngine.setStablecoin(user.address, RESERVE_BAL);

      await bondIssuer.purchaseBond(BUY_AMOUNT);
    });

    it("fails if reservePool doesn't have enough funds to redeem", async () => {
      await vaultEngine.setStablecoin(reservePool.address, 0);
      await assertRevert(
        bondIssuer.redeemTokens(BUY_AMOUNT),
        "BondIssuer/processRedemption: The reserve pool doesn't have enough funds"
      );
      await vaultEngine.setStablecoin(reservePool.address, RESERVE_BAL);
      await bondIssuer.redeemTokens(BUY_AMOUNT);
    });

    it("fails if user doesn't have enough tokens to redeem", async () => {
      await assertRevert(
        bondIssuer.connect(user).redeemTokens(BUY_AMOUNT),
        "BondIssuer/processRedemption: User doesn't have enough tokens to redeem this amount"
      );
      await bondIssuer.connect(user).purchaseBond(BUY_AMOUNT);
      await bondIssuer.connect(user).redeemTokens(BUY_AMOUNT);
    });

    it("tests that values are properly updated", async () => {
      const before = await bondIssuer.tokens(owner.address);
      await bondIssuer.redeemTokens(BUY_AMOUNT);
      const after = await bondIssuer.tokens(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });

    it("tests that correct amount of stablecoin is transferred", async () => {
      const before = await vaultEngine.balance(owner.address);
      await bondIssuer.redeemTokens(BUY_AMOUNT);
      const after = await vaultEngine.balance(owner.address);

      expect(after.sub(before).abs()).to.equal(BUY_AMOUNT);
    });
  });
});
