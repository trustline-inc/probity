import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  MockBondIssuer,
  MockVaultEngine,
  Registry,
  ReservePool,
  Teller,
} from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let liquidator: SignerWithAddress;
let admin: SignerWithAddress;

// Contracts
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePool: ReservePool;
let bondIssuer: MockBondIssuer;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("ReservePool Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;

    contracts = await probity.deployReservePool({
      vaultEngine: contracts.mockVaultEngine?.address,
      bondIssuer: contracts.mockBondIssuer?.address,
    });

    vaultEngine = contracts.mockVaultEngine!;
    reservePool = contracts.reservePool!;
    bondIssuer = contracts.mockBondIssuer!;

    owner = signers.owner!;
    user = signers.alice!;
    liquidator = signers.charlie!;
    admin = signers.don!;

    await registry.register(
      bytes32("liquidator"),
      liquidator.address,
      true
    );
  });

  describe("updateDebtThreshold Unit Tests", function () {
    const NEW_THRESHOLD = RAD.mul(20283);

    it("fails if caller is not 'admin'", async () => {
      await assertRevert(
        reservePool.connect(user).updateDebtThreshold(NEW_THRESHOLD),
        "callerDoesNotHaveRequiredRole"
      );
      await reservePool.updateDebtThreshold(NEW_THRESHOLD);
    });

    it("tests that values are properly set", async () => {
      const before = await reservePool.debtThreshold();
      expect(before).to.equal(0);

      await reservePool.updateDebtThreshold(NEW_THRESHOLD);
      const after = await reservePool.debtThreshold();
      expect(after).to.equal(NEW_THRESHOLD);
    });
  });

  describe("addAuctionDebt Unit Tests", function () {
    const AUCTION_DEBT_TO_ADD = RAD.mul(2938);
    it("fails if caller is not 'liquidator'", async () => {
      await assertRevert(
        reservePool.connect(user).addAuctionDebt(AUCTION_DEBT_TO_ADD),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.register(bytes32("liquidator"), user.address, true);
      await reservePool.connect(user).addAuctionDebt(AUCTION_DEBT_TO_ADD);
    });

    it("tests that values are properly set", async () => {
      await registry.register(bytes32("liquidator"), user.address, true);

      const before = await reservePool.debtOnAuction();
      await reservePool.connect(user).addAuctionDebt(AUCTION_DEBT_TO_ADD);
      const after = await reservePool.debtOnAuction();

      expect(after.sub(before)).to.equal(AUCTION_DEBT_TO_ADD);
    });
  });

  describe("reduceAuctionDebt Unit Tests", function () {
    const AUCTION_DEBT_TO_ADD = RAD.mul(2832);
    const AUCTION_DEBT_TO_REDUCE = RAD.mul(2212);
    beforeEach(async function () {
      await reservePool.connect(liquidator).addAuctionDebt(AUCTION_DEBT_TO_ADD);
    });

    it("fails if caller is not 'liquidator'", async () => {
      await assertRevert(
        reservePool.connect(user).reduceAuctionDebt(AUCTION_DEBT_TO_REDUCE),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.register(bytes32("liquidator"), user.address, true);
      await reservePool.connect(user).reduceAuctionDebt(AUCTION_DEBT_TO_REDUCE);
    });

    it("tests that values are properly set", async () => {
      const before = await reservePool.debtOnAuction();
      await reservePool
        .connect(liquidator)
        .addAuctionDebt(AUCTION_DEBT_TO_REDUCE);
      const after = await reservePool.debtOnAuction();

      expect(after.sub(before).abs()).to.equal(AUCTION_DEBT_TO_REDUCE);
    });
  });

  describe("settle Unit Tests", function () {
    const UNBACKED_DEBT_TO_SET = RAD.mul(2837);
    const AMOUNT_TO_SETTLE = RAD.mul(287);

    beforeEach(async function () {
      await vaultEngine.setSystemDebt(
        reservePool.address,
        UNBACKED_DEBT_TO_SET
      );
      await vaultEngine
        .connect(liquidator)
        .setSystemCurrency(reservePool.address, AMOUNT_TO_SETTLE);
    });

    it("fails if caller is not by Probity", async () => {
      await assertRevert(
        reservePool.connect(user).settle(AMOUNT_TO_SETTLE),
        "callerIsNotFromProbitySystem()"
      );
      await registry.register(bytes32("liquidator"), user.address, true);
      await reservePool.connect(user).settle(AMOUNT_TO_SETTLE);
    });

    it("fails if amountToSettle is more than systemDebt", async () => {
      await assertRevert(
        reservePool.connect(liquidator).settle(UNBACKED_DEBT_TO_SET.add(1)),
        "settlementAmountMustBeLowerThanDebt()"
      );
      await vaultEngine
        .connect(liquidator)
        .setSystemCurrency(reservePool.address, UNBACKED_DEBT_TO_SET);
      await reservePool.connect(liquidator).settle(UNBACKED_DEBT_TO_SET.sub(1));
    });

    it("fails if Systemcurrency balance is less than amountToSettle", async () => {
      await assertRevert(
        reservePool.connect(liquidator).settle(AMOUNT_TO_SETTLE.add(1)),
        "insufficientBalance()"
      );
      await reservePool.connect(liquidator).settle(AMOUNT_TO_SETTLE);
    });

    it("calls vault Engine's settle is called with correct parameter", async () => {
      const before = await vaultEngine.systemDebt(reservePool.address);
      await reservePool.connect(liquidator).settle(AMOUNT_TO_SETTLE);
      const after = await vaultEngine.systemDebt(reservePool.address);
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_SETTLE);
    });
  });

  describe("increaseSystemDebt Unit Tests", function () {
    const AMOUNT_TO_INCREASE = RAD.mul(283);
    it("fails if caller is not by Probity", async () => {
      await assertRevert(
        reservePool.connect(user).increaseSystemDebt(AMOUNT_TO_INCREASE),
        "callerIsNotFromProbitySystem()"
      );
      await registry.register(bytes32("liquidator"), user.address, true);
      await reservePool.connect(user).increaseSystemDebt(AMOUNT_TO_INCREASE);
    });

    it("calls vault Engine's increaseSystemDebt is called with correct parameter", async () => {
      const before = await vaultEngine.systemDebt(reservePool.address);
      await reservePool
        .connect(liquidator)
        .increaseSystemDebt(AMOUNT_TO_INCREASE);
      const after = await vaultEngine.systemDebt(reservePool.address);
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_INCREASE);
    });
  });

  describe("sendSystemCurrency Unit Tests", function () {
    const AMOUNT_TO_SEND = RAD.mul(283);
    beforeEach(async function () {
      await vaultEngine
        .connect(liquidator)
        .setSystemCurrency(reservePool.address, AMOUNT_TO_SEND);
    });

    it("fails if caller is not by admin", async () => {
      await assertRevert(
        reservePool
          .connect(user)
          .sendSystemCurrency(owner.address, AMOUNT_TO_SEND),
        "callerDoesNotHaveRequiredRole"
      );
      await registry.register(bytes32("admin"), user.address, true);
      await reservePool
        .connect(user)
        .sendSystemCurrency(owner.address, AMOUNT_TO_SEND);
    });

    it("tests that values are properly set", async () => {
      await registry.register(bytes32("admin"), user.address, true);

      const before = await vaultEngine.systemCurrency(owner.address);
      await reservePool
        .connect(user)
        .sendSystemCurrency(owner.address, AMOUNT_TO_SEND);
      const after = await vaultEngine.systemCurrency(owner.address);
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_SEND);
    });
  });

  describe("startBondSale Unit Tests", function () {
    const DEBT_THRESHOLD = RAD.mul(20000);
    beforeEach(async function () {
      await reservePool.updateDebtThreshold(DEBT_THRESHOLD);
      await vaultEngine
        .connect(liquidator)
        .setSystemDebt(reservePool.address, DEBT_THRESHOLD.mul(2));
    });

    it("fails if caller is not by reservePool", async () => {
      await assertRevert(
        reservePool.connect(user).startBondSale(),
        "callerIsNotFromProbitySystem()"
      );
      await registry.register(bytes32("admin"), user.address, true);
      await reservePool.connect(user).startBondSale();
    });

    it("fails if debt threshold has not been crossed yet", async () => {
      await vaultEngine
        .connect(liquidator)
        .setSystemDebt(reservePool.address, DEBT_THRESHOLD.sub(1));

      await assertRevert(
        reservePool.connect(liquidator).startBondSale(),
        "debtStillUnderThreshold()"
      );
      await vaultEngine
        .connect(liquidator)
        .setSystemDebt(reservePool.address, DEBT_THRESHOLD.add(1));
      await reservePool.connect(liquidator).startBondSale();
    });

    it("fails reservePool's Systemcurrency balance is still positive", async () => {
      await vaultEngine
        .connect(liquidator)
        .setSystemCurrency(reservePool.address, RAD);

      await assertRevert(
        reservePool.connect(liquidator).startBondSale(),
        "systemCurrencyBalanceMustBeZero()"
      );
      await vaultEngine
        .connect(liquidator)
        .setSystemCurrency(reservePool.address, 0);
      await reservePool.connect(liquidator).startBondSale();
    });

    it("tests that values are properly set", async () => {
      const before = await bondIssuer.lastOfferingAmount();
      expect(before).to.equal(0);
      await reservePool.connect(liquidator).startBondSale();
      const after = await bondIssuer.lastOfferingAmount();
      expect(after).to.equal(DEBT_THRESHOLD);
    });
  });
});
