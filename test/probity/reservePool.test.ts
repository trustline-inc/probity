import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  MockBonds,
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
let gov: SignerWithAddress;

// Contracts
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePool: ReservePool;
let bonds: MockBonds;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("ReservePool Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;

    contracts = await probity.deployReservePool({
      vaultEngine: contracts.mockVaultEngine.address,
      bonds: contracts.mockBonds.address,
    });

    vaultEngine = contracts.mockVaultEngine;
    reservePool = contracts.reservePool;
    bonds = contracts.mockBonds;

    owner = signers.owner;
    user = signers.alice;
    liquidator = signers.charlie;
    gov = signers.don;

    await registry.setupAddress(bytes32("liquidator"), liquidator.address);
  });

  describe("updateDebtThreshold Unit Tests", function () {
    const NEW_THRESHOLD = RAD.mul(20283);

    it("fails if caller is not 'gov'", async () => {
      await assertRevert(
        reservePool.connect(user).updateDebtThreshold(NEW_THRESHOLD),
        "AccessControl/onlyBy: Caller does not have permission"
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
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("liquidator"), user.address);
      await reservePool.connect(user).addAuctionDebt(AUCTION_DEBT_TO_ADD);
    });

    it("tests that values are properly set", async () => {
      await registry.setupAddress(bytes32("liquidator"), user.address);

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
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("liquidator"), user.address);
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
      await vaultEngine.setUnbackedDebt(
        reservePool.address,
        UNBACKED_DEBT_TO_SET
      );
      await vaultEngine
        .connect(liquidator)
        .setStablecoin(reservePool.address, AMOUNT_TO_SETTLE);
    });

    it("fails if caller is not by Probity", async () => {
      await assertRevert(
        reservePool.connect(user).settle(AMOUNT_TO_SETTLE),
        "AccessControl/onlyByProbity: Caller must be from Probity system contract"
      );
      await registry.setupAddress(bytes32("liquidator"), user.address);
      await reservePool.connect(user).settle(AMOUNT_TO_SETTLE);
    });

    it("fails if amountToSettle is more than unBackedDebt", async () => {
      await assertRevert(
        reservePool.connect(liquidator).settle(UNBACKED_DEBT_TO_SET.add(1)),
        "ReservePool/settle: Settlement amount is more than the debt"
      );
      await vaultEngine
        .connect(liquidator)
        .setStablecoin(reservePool.address, UNBACKED_DEBT_TO_SET);
      await reservePool.connect(liquidator).settle(UNBACKED_DEBT_TO_SET.sub(1));
    });

    it("fails if stablecoin balance is less than amountToSettle", async () => {
      await assertRevert(
        reservePool.connect(liquidator).settle(AMOUNT_TO_SETTLE.add(1)),
        "ReservePool/settle: Not enough balance to settle"
      );
      await reservePool.connect(liquidator).settle(AMOUNT_TO_SETTLE);
    });

    it("calls vault Engine's settle is called with correct parameter", async () => {
      const before = await vaultEngine.unbackedDebt(reservePool.address);
      await reservePool.connect(liquidator).settle(AMOUNT_TO_SETTLE);
      const after = await vaultEngine.unbackedDebt(reservePool.address);
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_SETTLE);
    });
  });

  describe("increaseSystemDebt Unit Tests", function () {
    const AMOUNT_TO_INCREASE = RAD.mul(283);
    it("fails if caller is not by Probity", async () => {
      await assertRevert(
        reservePool.connect(user).increaseSystemDebt(AMOUNT_TO_INCREASE),
        "AccessControl/onlyByProbity: Caller must be from Probity system contract"
      );
      await registry.setupAddress(bytes32("liquidator"), user.address);
      await reservePool.connect(user).increaseSystemDebt(AMOUNT_TO_INCREASE);
    });

    it("calls vault Engine's increaseSystemDebt is called with correct parameter", async () => {
      const before = await vaultEngine.unbackedDebt(reservePool.address);
      await reservePool
        .connect(liquidator)
        .increaseSystemDebt(AMOUNT_TO_INCREASE);
      const after = await vaultEngine.unbackedDebt(reservePool.address);
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_INCREASE);
    });
  });

  describe("sendStablecoin Unit Tests", function () {
    const AMOUNT_TO_SEND = RAD.mul(283);
    beforeEach(async function () {
      await vaultEngine
        .connect(liquidator)
        .setStablecoin(reservePool.address, AMOUNT_TO_SEND);
    });

    it("fails if caller is not by gov", async () => {
      await assertRevert(
        reservePool.connect(user).sendStablecoin(owner.address, AMOUNT_TO_SEND),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await reservePool
        .connect(user)
        .sendStablecoin(owner.address, AMOUNT_TO_SEND);
    });

    it("tests that values are properly set", async () => {
      await registry.setupAddress(bytes32("gov"), user.address);

      const before = await vaultEngine.stablecoin(owner.address);
      await reservePool
        .connect(user)
        .sendStablecoin(owner.address, AMOUNT_TO_SEND);
      const after = await vaultEngine.stablecoin(owner.address);
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_SEND);
    });
  });

  describe("startSale Unit Tests", function () {
    const DEBT_THRESHOLD = RAD.mul(20000);
    beforeEach(async function () {
      await reservePool.updateDebtThreshold(DEBT_THRESHOLD);
      await vaultEngine
        .connect(liquidator)
        .setUnbackedDebt(reservePool.address, DEBT_THRESHOLD.mul(2));
    });

    it("fails if caller is not by reservePool", async () => {
      await assertRevert(
        reservePool.connect(user).startSale(),
        "AccessControl/onlyByProbity: Caller must be from Probity system contract"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await reservePool.connect(user).startSale();
    });

    it("fails if debt threshold has not been crossed yet", async () => {
      await vaultEngine
        .connect(liquidator)
        .setUnbackedDebt(reservePool.address, DEBT_THRESHOLD.sub(1));

      await assertRevert(
        reservePool.connect(liquidator).startSale(),
        "ReservePool/startSale: Debt threshold is not yet crossed"
      );
      await vaultEngine
        .connect(liquidator)
        .setUnbackedDebt(reservePool.address, DEBT_THRESHOLD.add(1));
      await reservePool.connect(liquidator).startSale();
    });

    it("fails reservePool's stablecoin balance is still positive", async () => {
      await vaultEngine
        .connect(liquidator)
        .setStablecoin(reservePool.address, RAD);

      await assertRevert(
        reservePool.connect(liquidator).startSale(),
        "ReservePool/startSale: Stablecoin balance is still positive"
      );
      await vaultEngine
        .connect(liquidator)
        .setStablecoin(reservePool.address, 0);
      await reservePool.connect(liquidator).startSale();
    });

    it("tests that values are properly set", async () => {
      const before = await bonds.lastOfferingAmount();
      expect(before).to.equal(0);
      await reservePool.connect(liquidator).startSale();
      const after = await bonds.lastOfferingAmount();
      expect(after).to.equal(DEBT_THRESHOLD);
    });
  });
});
