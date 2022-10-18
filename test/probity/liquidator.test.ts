import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Liquidator,
  MockAuctioneer,
  MockFtso,
  MockPriceFeed,
  MockReservePool,
  MockVaultEngine,
  NativeAssetManager,
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
  ASSET_ID,
  bytes32,
  RAD,
  WAD,
  RAY,
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
let treasury: Treasury;
let priceFeed: MockPriceFeed;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Liquidator Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();

    // Set contracts
    registry = contracts.registry!;
    vaultEngine = contracts.mockVaultEngine!;
    reservePool = contracts.mockReservePool!;
    auctioneer = contracts.mockAuctioneer!;
    treasury = contracts.treasury!;
    priceFeed = contracts.mockPriceFeed!;

    contracts = await probity.deployLiquidator({
      registry: registry.address,
      vaultEngine: vaultEngine.address,
      reservePool: reservePool.address,
      priceFeed: priceFeed.address,
      treasury: treasury.address,
    });

    liquidator = contracts.liquidator!;

    owner = signers.owner!;
    user = signers.alice!;
  });

  describe("initAsset Unit Tests", function () {
    it("fails if asset has already been initialized", async () => {
      const EXPECTED_AUCTIONEER_ADDRESS = user.address;

      await liquidator.initAsset(ASSET_ID.FLR, EXPECTED_AUCTIONEER_ADDRESS);
      await assertRevert(
        liquidator.initAsset(ASSET_ID.FLR, EXPECTED_AUCTIONEER_ADDRESS),
        "Liquidator/initAsset: This asset has already been initialized"
      );
    });

    it("tests that collateral type is properly initialized", async () => {
      const EXPECTED_AUCTIONEER_ADDRESS = user.address;
      const EXPECTED_DEBT_PENALTY_FEE = WAD.mul(17).div(100);
      const EXPECTED_SUPP_PENALTY_FEE = WAD.mul(5).div(100);

      const before = await liquidator.assets(ASSET_ID.FLR);
      expect(before.auctioneer).to.equal(ADDRESS_ZERO);
      expect(before.debtPenaltyFee).to.equal(0);
      expect(before.equityPenaltyFee).to.equal(0);

      await liquidator.initAsset(ASSET_ID.FLR, EXPECTED_AUCTIONEER_ADDRESS);

      const after = await liquidator.assets(ASSET_ID.FLR);
      expect(after.auctioneer).to.equal(EXPECTED_AUCTIONEER_ADDRESS);
      expect(after.debtPenaltyFee).to.equal(EXPECTED_DEBT_PENALTY_FEE);
      expect(after.equityPenaltyFee).to.equal(EXPECTED_SUPP_PENALTY_FEE);
    });
  });

  describe("updatePenalties Unit Tests", function () {
    const DEFAULT_DEBT_PENALTY_FEE = WAD.mul(17).div(100);
    const DEFAULT_SUPP_PENALTY_FEE = WAD.mul(5).div(100);
    beforeEach(async function () {
      await liquidator.initAsset(ASSET_ID.FLR, auctioneer.address);
    });

    it("tests that penaltyFees are updated correctly", async () => {
      const NEW_DEBT_PENALTY_FEE = RAY.mul(123).div(100);
      const NEW_SUPP_PENALTY_FEE = RAY.mul(107).div(100);
      const before = await liquidator.assets(ASSET_ID.FLR);
      expect(before.debtPenaltyFee).to.equal(DEFAULT_DEBT_PENALTY_FEE);
      expect(before.equityPenaltyFee).to.equal(DEFAULT_SUPP_PENALTY_FEE);

      await liquidator.updatePenalties(
        ASSET_ID.FLR,
        NEW_DEBT_PENALTY_FEE,
        NEW_SUPP_PENALTY_FEE
      );

      const after = await liquidator.assets(ASSET_ID.FLR);
      expect(after.debtPenaltyFee).to.equal(NEW_DEBT_PENALTY_FEE);
      expect(after.equityPenaltyFee).to.equal(NEW_SUPP_PENALTY_FEE);
    });
  });

  describe("updateAuctioneer Unit Tests", function () {
    beforeEach(async function () {
      await liquidator.initAsset(ASSET_ID.FLR, auctioneer.address);
    });

    it("tests that auctioneer address is updated correctly", async () => {
      const DEFAULT_AUCTIONEER_ADDRESS = auctioneer.address;
      const NEW_AUCTIONEER_ADDRESS = owner.address;
      const before = await liquidator.assets(ASSET_ID.FLR);
      expect(before.auctioneer).to.equal(DEFAULT_AUCTIONEER_ADDRESS);

      await liquidator.updateAuctioneer(ASSET_ID.FLR, NEW_AUCTIONEER_ADDRESS);

      const after = await liquidator.assets(ASSET_ID.FLR);
      expect(after.auctioneer).to.equal(NEW_AUCTIONEER_ADDRESS);
    });
  });

  describe("reduceAuctionDebt Unit Tests", function () {
    beforeEach(async function () {
      await liquidator.initAsset(ASSET_ID.FLR, auctioneer.address);
    });

    it("fail if caller is not auctioneer contract", async () => {
      const REDUCE_AUCTION_DEBT_AMOUNT = RAD.mul(2837);

      await assertRevert(
        liquidator.connect(user).reduceAuctionDebt(REDUCE_AUCTION_DEBT_AMOUNT),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry.setupAddress(bytes32("auctioneer"), user.address, true);

      await liquidator
        .connect(user)
        .reduceAuctionDebt(REDUCE_AUCTION_DEBT_AMOUNT);
    });

    it("tests that reservePool's reduceAuctionDebt is called with correct parameters", async () => {
      await registry.setupAddress(bytes32("auctioneer"), user.address, true);

      const REDUCE_AUCTION_DEBT_AMOUNT = RAD.mul(2837);

      const before = await reservePool.lastReduceAuctionDebtAmount();

      expect(before).to.equal(0);
      await liquidator
        .connect(user)
        .reduceAuctionDebt(REDUCE_AUCTION_DEBT_AMOUNT);
      const after = await reservePool.lastReduceAuctionDebtAmount();
      expect(after).to.equal(REDUCE_AUCTION_DEBT_AMOUNT);
    });
  });

  describe("liquidateVault Unit Tests", function () {
    const UNDERLYING = WAD.mul(499);
    const COLLATERAL = WAD.mul(499);
    const DEBT = WAD.mul(500);
    const EQUITY = WAD.mul(500);
    const DEBT_ACCUMULATOR = RAY;
    const EQUITY_ACCUMULATOR = RAY;
    const PRICE = RAY;

    beforeEach(async function () {
      await liquidator.initAsset(ASSET_ID.FLR, auctioneer.address);
      await vaultEngine.updateAsset(
        ASSET_ID.FLR,
        PRICE,
        DEBT,
        EQUITY,
        RAD.mul(1_000_000),
        0
      );
      await vaultEngine.updateAccumulators(reservePool.address, 0, 0, 0);
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        UNDERLYING,
        COLLATERAL,
        DEBT,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await vaultEngine.setSystemCurrency(treasury.address, EQUITY.mul(RAY));
      await priceFeed.setPrice(ASSET_ID.FLR, RAY);
    });

    it("fails if vault has nothing to liquidate", async () => {
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        0,
        0,
        0,
        0
      );

      await assertRevert(
        liquidator.liquidateVault(ASSET_ID.FLR, user.address),
        "Lidquidator: Nothing to liquidate"
      );

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        UNDERLYING,
        COLLATERAL,
        DEBT,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);
    });

    it("fails if vault is not undercollateralized ", async () => {
      // 1000 underlying, 1000 FLR collateral, 500 debt, 500 equity, 150% L.R.
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        UNDERLYING.add(WAD.mul(1)),
        COLLATERAL.add(WAD.mul(1)),
        DEBT,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await assertRevert(
        liquidator.liquidateVault(ASSET_ID.FLR, user.address),
        "Liquidator: Vault both equity and debt positions are above the liquidation ratio"
      );

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        UNDERLYING,
        COLLATERAL,
        DEBT,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);
    });

    it("fails if treasury has not enough funds when liquidating equity position ", async () => {
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        UNDERLYING,
        COLLATERAL,
        DEBT,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await vaultEngine.setSystemCurrency(treasury.address, 0);

      await assertRevert(
        liquidator.liquidateVault(ASSET_ID.FLR, user.address),
        "VaultEngine/liquidateEquityPosition: Not enough treasury funds"
      );

      await vaultEngine.setSystemCurrency(treasury.address, RAD.mul(100000));
      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);
    });

    it("test that when underlying is less than assetToAuction, all of underlying is auctioned off", async () => {
      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        WAD,
        0,
        0,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await vaultEngine.updateAsset(
        ASSET_ID.FLR,
        PRICE.div(1000),
        DEBT,
        EQUITY,
        RAD.mul(1_000_000),
        0
      );

      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);

      const after = await vaultEngine.lastLiquidateEquityPositionCall();
      expect(after.assetToAuction.abs()).to.equal(WAD);
    });

    it("adds reserve pool auction debt", async () => {
      const EXPECTED_AUCTION_DEBT = DEBT.mul(DEBT_ACCUMULATOR);

      const before = await reservePool.lastAddAuctionDebtAmount();
      expect(before).to.equal(0);
      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);

      const after = await reservePool.lastAddAuctionDebtAmount();
      expect(after).to.equal(EXPECTED_AUCTION_DEBT);
    });

    it("calls vaultEngine's liquidateVault with the correct parameters", async () => {
      const EXPECTED_COLL_AMOUNT = WAD.mul(0).sub(COLLATERAL);
      const EXPECTED_DEBT_AMOUNT = WAD.mul(0).sub(DEBT);
      const EXPECTED_AMOUNT_TO_AUCTION = BigNumber.from(0).sub(
        EQUITY.mul(5).div(100)
      );
      const EXPECTED_AMOUNT_TO_RETURN = BigNumber.from(0)
        .sub(UNDERLYING)
        .sub(EXPECTED_AMOUNT_TO_AUCTION);
      const EXPECTED_EQUITY_AMOUNT = BigNumber.from(0).sub(EQUITY);

      const before = await vaultEngine.lastLiquidateDebtPositionCall();
      expect(before.assetId).to.equal(bytes32(""));
      expect(before.user).to.equal(ADDRESS_ZERO);
      expect(before.auctioneer).to.equal(ADDRESS_ZERO);
      expect(before.reservePool).to.equal(ADDRESS_ZERO);
      expect(before.collateralAmount).to.equal(0);
      expect(before.debtAmount).to.equal(0);

      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);

      const after = await vaultEngine.lastLiquidateDebtPositionCall();
      expect(after.assetId).to.equal(ASSET_ID.FLR);
      expect(after.user).to.equal(user.address);
      expect(after.auctioneer).to.equal(auctioneer.address);
      expect(after.reservePool).to.equal(reservePool.address);
      expect(after.collateralAmount).to.equal(EXPECTED_COLL_AMOUNT);
      expect(after.debtAmount).to.equal(EXPECTED_DEBT_AMOUNT);

      const lastEquityLiquidateCall =
        await vaultEngine.lastLiquidateEquityPositionCall();
      expect(lastEquityLiquidateCall.assetId).to.equal(ASSET_ID.FLR);
      expect(lastEquityLiquidateCall.user).to.equal(user.address);
      expect(lastEquityLiquidateCall.auctioneer).to.equal(auctioneer.address);

      expect(lastEquityLiquidateCall.assetToAuction).to.equal(
        EXPECTED_AMOUNT_TO_AUCTION
      );
      expect(lastEquityLiquidateCall.assetToReturn).to.equal(
        EXPECTED_AMOUNT_TO_RETURN
      );
      expect(lastEquityLiquidateCall.equity).to.equal(EXPECTED_EQUITY_AMOUNT);
    });

    it("calls auctioneer's startAuction with the correct parameters", async () => {
      const EXPECTED_DEBT_SIZE = DEBT.mul(117).div(100).mul(DEBT_ACCUMULATOR);
      const before = await auctioneer.lastStartAuctionCall();
      expect(before.assetId).to.equal(bytes32(""));
      expect(before.lotSize).to.equal(0);
      expect(before.debtSize).to.equal(0);
      expect(before.owner).to.equal(ADDRESS_ZERO);
      expect(before.beneficiary).to.equal(ADDRESS_ZERO);

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        0,
        COLLATERAL,
        DEBT,
        0,
        0
      );

      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);

      let after = await auctioneer.lastStartAuctionCall();
      expect(after.assetId).to.equal(ASSET_ID.FLR);
      expect(after.lotSize).to.equal(COLLATERAL);
      expect(after.debtSize).to.equal(EXPECTED_DEBT_SIZE);
      expect(after.owner).to.equal(user.address);
      expect(after.beneficiary).to.equal(reservePool.address);

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user.address,
        0,
        UNDERLYING,
        0,
        0,
        EQUITY,
        EQUITY.mul(RAY)
      );

      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);

      after = await auctioneer.lastStartAuctionCall();
      expect(after.assetId).to.equal(ASSET_ID.FLR);
      expect(after.lotSize).to.equal(EQUITY.mul(5).div(100));
      expect(after.debtSize).to.equal(EQUITY.mul(RAY).mul(5).div(100));
      expect(after.owner).to.equal(reservePool.address);
      expect(after.beneficiary).to.equal(reservePool.address);
    });

    it("tests that removeSystemCurrency is called when liquidating Equity position", async () => {
      const EXPECTED_DIFF = EQUITY.mul(RAY);

      const before = await vaultEngine.systemCurrency(treasury.address);
      await liquidator.liquidateVault(ASSET_ID.FLR, user.address);

      const after = await vaultEngine.systemCurrency(treasury.address);
      expect(before.sub(after)).to.equal(EXPECTED_DIFF);
    });
  });
});
