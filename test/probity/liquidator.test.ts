import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Liquidator,
  MockAuctioneer,
  MockFtso,
  MockReservePool,
  MockVaultEngine,
  NativeCollateral,
  PriceFeed,
  Registry,
  ReservePool,
  Teller,
  Treasury,
  VaultEngine,
} from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import {
  ADDRESS_ZERO,
  bytes32,
  PRECISION_AUR,
  PRECISION_COLL,
  PRECISION_PRICE,
} from "../utils/constants";
import { BigNumber } from "ethers";
import assertRevert from "../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePool: MockReservePool;
let auctioneer: MockAuctioneer;
let liquidator: Liquidator;

let flrCollId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Liquidator Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.mockVaultEngine;
    reservePool = contracts.mockReserve;
    auctioneer = contracts.mockAuctioneer;

    contracts = await probity.deployLiquidator({
      registry: registry.address,
      vaultEngine: vaultEngine.address,
      reservePool: reservePool.address,
    });

    liquidator = contracts.liquidator;

    owner = signers.owner;
    user = signers.alice;
  });

  describe("init Unit Tests", function () {
    it("tests that collateral type is properly initialized", async () => {
      const EXPECTED_AUCTIONEER_ADDRESS = user.address;
      const EXPECTED_DEBT_PENALTY_FEE = PRECISION_COLL.mul(117).div(100);
      const EXPECTED_SUPP_PENALTY_FEE = PRECISION_COLL.mul(105).div(100);

      const before = await liquidator.collateralTypes(flrCollId);
      expect(before.auctioneer).to.equal(ADDRESS_ZERO);
      expect(before.debtPenaltyFee).to.equal(0);
      expect(before.equityPenaltyFee).to.equal(0);

      await liquidator.init(flrCollId, EXPECTED_AUCTIONEER_ADDRESS);

      const after = await liquidator.collateralTypes(flrCollId);
      expect(after.auctioneer).to.equal(EXPECTED_AUCTIONEER_ADDRESS);
      expect(after.debtPenaltyFee).to.equal(EXPECTED_DEBT_PENALTY_FEE);
      expect(after.equityPenaltyFee).to.equal(EXPECTED_SUPP_PENALTY_FEE);
    });
  });

  describe("updatePenalties Unit Tests", function () {
    const DEFAULT_DEBT_PENALTY_FEE = PRECISION_COLL.mul(117).div(100);
    const DEFAULT_SUPP_PENALTY_FEE = PRECISION_COLL.mul(105).div(100);
    beforeEach(async function () {
      await liquidator.init(flrCollId, auctioneer.address);
    });

    it("tests that penaltyFees are e is updated correctly", async () => {
      const NEW_DEBT_PENALTY_FEE = PRECISION_PRICE.mul(123).div(100);
      const NEW_SUPP_PENALTY_FEE = PRECISION_PRICE.mul(107).div(100);
      const before = await liquidator.collateralTypes(flrCollId);
      expect(before.debtPenaltyFee).to.equal(DEFAULT_DEBT_PENALTY_FEE);
      expect(before.equityPenaltyFee).to.equal(DEFAULT_SUPP_PENALTY_FEE);

      await liquidator.updatePenalties(
        flrCollId,
        NEW_DEBT_PENALTY_FEE,
        NEW_SUPP_PENALTY_FEE
      );

      const after = await liquidator.collateralTypes(flrCollId);
      expect(after.debtPenaltyFee).to.equal(NEW_DEBT_PENALTY_FEE);
      expect(after.equityPenaltyFee).to.equal(NEW_SUPP_PENALTY_FEE);
    });
  });

  describe("updateAuctioneer Unit Tests", function () {
    beforeEach(async function () {
      await liquidator.init(flrCollId, auctioneer.address);
    });

    it("tests that auctioneer address is updated correctly", async () => {
      const DEFAULT_AUCTIONEER_ADDRESS = auctioneer.address;
      const NEW_AUCTIONEER_ADDRESS = owner.address;
      const before = await liquidator.collateralTypes(flrCollId);
      expect(before.auctioneer).to.equal(DEFAULT_AUCTIONEER_ADDRESS);

      await liquidator.updateAuctioneer(flrCollId, NEW_AUCTIONEER_ADDRESS);

      const after = await liquidator.collateralTypes(flrCollId);
      expect(after.auctioneer).to.equal(NEW_AUCTIONEER_ADDRESS);
    });
  });

  describe("reduceAuctionDebt Unit Tests", function () {
    beforeEach(async function () {
      await liquidator.init(flrCollId, auctioneer.address);
    });

    it("tests that reservePool's reduceAuctionDebt is called with correct parameters", async () => {
      const REDUCE_AUCTION_DEBT_AMOUNT = PRECISION_AUR.mul(2837);

      const before = await reservePool.lastReduceAuctionDebtAmount();
      expect(before).to.equal(0);
      await liquidator.reduceAuctionDebt(REDUCE_AUCTION_DEBT_AMOUNT);
      const after = await reservePool.lastReduceAuctionDebtAmount();
      expect(after).to.equal(REDUCE_AUCTION_DEBT_AMOUNT);
    });
  });

  describe("liquidateVault Unit Tests", function () {
    const VAULT_LOCKED_COLL = PRECISION_COLL.mul(999);
    const VAULT_DEBT = PRECISION_COLL.mul(500);
    const VAULT_EQUITY = PRECISION_COLL.mul(500);
    const DEBT_ACCUMULATOR = PRECISION_PRICE;
    const EQUITY_ACCUMULATOR = PRECISION_PRICE;
    const PRICE = PRECISION_PRICE;

    beforeEach(async function () {
      await liquidator.init(flrCollId, auctioneer.address);
      await vaultEngine.updateAsset(
        flrCollId,
        PRICE,
        VAULT_DEBT,
        VAULT_EQUITY,
        PRECISION_AUR.mul(1000000),
        0
      );
      await vaultEngine.updateAccumulators(
        flrCollId,
        reservePool.address,
        DEBT_ACCUMULATOR,
        EQUITY_ACCUMULATOR,
        0
      );
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        VAULT_LOCKED_COLL,
        VAULT_DEBT,
        VAULT_EQUITY,
        0
      );
    });

    it("fails if vault has nothing to liquidate", async () => {
      await vaultEngine.updateVault(flrCollId, user.address, 0, 0, 0, 0, 0);

      await assertRevert(
        liquidator.liquidateVault(flrCollId, user.address),
        "Lidquidator: Nothing to liquidate"
      );

      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        VAULT_LOCKED_COLL,
        VAULT_DEBT,
        VAULT_EQUITY,
        0
      );

      await liquidator.liquidateVault(flrCollId, user.address);
    });

    it("fails if vault is not undercollateralized ", async () => {
      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        VAULT_LOCKED_COLL.add(PRECISION_COLL.mul(2)),
        VAULT_DEBT,
        VAULT_EQUITY,
        0
      );

      await assertRevert(
        liquidator.liquidateVault(flrCollId, user.address),
        "Liquidator: Vault collateral is still above required minimal ratio"
      );

      await vaultEngine.updateVault(
        flrCollId,
        user.address,
        0,
        VAULT_LOCKED_COLL,
        VAULT_DEBT,
        VAULT_EQUITY,
        0
      );

      await liquidator.liquidateVault(flrCollId, user.address);
    });

    it("test that reservePool's addAuctionDebt is called with correct parameters", async () => {
      const EXPECTED_AUCTION_DEBT =
        VAULT_DEBT.add(VAULT_EQUITY).mul(DEBT_ACCUMULATOR);

      const before = await reservePool.lastAddAuctionDebtAmount();
      expect(before).to.equal(0);
      await liquidator.liquidateVault(flrCollId, user.address);

      const after = await reservePool.lastAddAuctionDebtAmount();
      expect(after).to.equal(EXPECTED_AUCTION_DEBT);
    });

    it("test that vaultEngine's liquidateVault is called with correct parameters", async () => {
      const EXPECTD_COLL_AMOUNT = PRECISION_COLL.mul(0).sub(VAULT_LOCKED_COLL);
      const EXPECTED_DEBT_AMOUNT = PRECISION_COLL.mul(0).sub(VAULT_DEBT);
      const EXPECTED_EQUITY_AMOUNT = PRECISION_COLL.mul(0).sub(VAULT_EQUITY);

      const before = await vaultEngine.lastLiquidateVaultCall();
      expect(before.collId).to.equal(bytes32(""));
      expect(before.user).to.equal(ADDRESS_ZERO);
      expect(before.auctioneer).to.equal(ADDRESS_ZERO);
      expect(before.reservePool).to.equal(ADDRESS_ZERO);
      expect(before.collateralAmount).to.equal(0);
      expect(before.debtAmount).to.equal(0);
      expect(before.equityAmount).to.equal(0);

      await liquidator.liquidateVault(flrCollId, user.address);

      const after = await vaultEngine.lastLiquidateVaultCall();
      expect(after.collId).to.equal(flrCollId);
      expect(after.user).to.equal(user.address);
      expect(after.auctioneer).to.equal(auctioneer.address);
      expect(after.reservePool).to.equal(reservePool.address);
      expect(after.collateralAmount).to.equal(EXPECTD_COLL_AMOUNT);
      expect(after.debtAmount).to.equal(EXPECTED_DEBT_AMOUNT);
      expect(after.equityAmount).to.equal(EXPECTED_EQUITY_AMOUNT);
    });

    it("test that auctioneer's startAuction is called with correct parameters", async () => {
      const EXPECTED_DEBT_SIZE = VAULT_DEBT.mul(117)
        .div(100)
        .add(VAULT_EQUITY.mul(105).div(100))
        .mul(DEBT_ACCUMULATOR);
      const before = await auctioneer.lastStartAuctionCall();
      expect(before.collId).to.equal(bytes32(""));
      expect(before.lotSize).to.equal(0);
      expect(before.debtSize).to.equal(0);
      expect(before.owner).to.equal(ADDRESS_ZERO);
      expect(before.beneficiary).to.equal(ADDRESS_ZERO);
      await liquidator.liquidateVault(flrCollId, user.address);

      const after = await auctioneer.lastStartAuctionCall();
      expect(after.collId).to.equal(flrCollId);
      expect(after.lotSize).to.equal(VAULT_LOCKED_COLL);
      expect(after.debtSize).to.equal(EXPECTED_DEBT_SIZE);
      expect(after.owner).to.equal(user.address);
      expect(after.beneficiary).to.equal(reservePool.address);
    });
  });
});
