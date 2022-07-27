import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Auctioneer,
  MockFtso,
  NativeAssetManager,
  PriceFeed,
  Registry,
  ReservePool,
  Teller,
  Treasury,
  VaultEngine,
} from "../../typechain";

import { deployTest } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { ASSET_ID, bytes32, RAD, WAD, RAY } from "../utils/constants";
import { BigNumber } from "ethers";
import assertRevert from "../utils/assertRevert";

const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let assetManager: SignerWithAddress;

// Contracts
let vaultEngine: VaultEngine;
let registry: Registry;
let reservePool: ReservePool;
let nativeAssetManager: NativeAssetManager;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;
let auctioneer: Auctioneer;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();

    // Set contracts
    registry = contracts.registry!;
    vaultEngine = contracts.vaultEngine!;
    reservePool = contracts.reservePool!;
    nativeAssetManager = contracts.nativeAssetManager!;
    teller = contracts.teller!;
    priceFeed = contracts.priceFeed!;
    ftso = contracts.ftso!;
    treasury = contracts.treasury!;
    auctioneer = contracts.auctioneer!;

    // Set signers
    owner = signers.owner!;
    user = signers.alice!;
    gov = signers.charlie!;
    assetManager = signers.don!;

    await registry.setupAddress(bytes32("gov"), gov.address, true);
    await registry.setupAddress(bytes32("whitelisted"), user.address, false);
    await registry.setupAddress(bytes32("whitelisted"), owner.address, false);
  });

  describe("modifyEquity Unit Tests", function () {
    const STANDBY_AMOUNT = WAD.mul(10_000);
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, STANDBY_AMOUNT);
    });

    it("fails if treasury address provided is not registered as treasury", async () => {
      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,
          user.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "Vault/modifyEquity: Treasury address is not valid"
      );

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("fails if supply ceiling has been reached", async () => {
      const NEW_CEILING = RAD.mul(2000);
      await vaultEngine.connect(gov).updateCeiling(ASSET_ID.FLR, NEW_CEILING);

      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT.add(1)
        ),
        "Vault/modifyEquity: Supply ceiling reached"
      );

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT.sub(1)
      );
    });

    it("only allows whitelisted users to call modifyEquity", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address, false);

      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address, false);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("fails if equity amount falls below the minimum (floor)", async () => {
      const FLOOR_AMOUNT = RAD.mul(1000);
      const EQUITY_AMOUNT_UNDER_FLOOR = FLOOR_AMOUNT.div(RAY).sub(1);

      // Add owner to the whitelist
      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address, false);

      // Update FLR asset floor
      await vaultEngine.connect(gov).updateFloor(ASSET_ID.FLR, FLOOR_AMOUNT);

      // Increase equity (expect revert)
      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT_UNDER_FLOOR
        ),
        "Vault/modifyEquity: Equity smaller than floor"
      );

      // Increase equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("updates balances when called with positive values", async () => {
      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.standby).to.equal(STANDBY_AMOUNT);
      expect(before.underlying).to.equal(0);
      expect(before.collateral).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      // Increase equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.standby).to.equal(0);
      expect(after.underlying).to.equal(UNDERLYING_AMOUNT);
      expect(after.collateral).to.equal(0);
      expect(after.debt).to.equal(0);
      expect(after.equity).to.equal(EQUITY_AMOUNT);
      expect(after.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY));
    });

    it("fails if vault debt goes below zero when called with negative values", async () => {
      // Increase equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      // Decrease equity (expect revert)
      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          BigNumber.from(0).sub(UNDERLYING_AMOUNT),
          BigNumber.from(0).sub(EQUITY_AMOUNT.add(1))
        ),
        "reverted with reason string 'Math/add: add op failed"
      );

      // Decrease equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        BigNumber.from(0).sub(UNDERLYING_AMOUNT),
        BigNumber.from(0).sub(EQUITY_AMOUNT)
      );
    });

    it("updates balances when called with negative values", async () => {
      // Increase equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      // Get balances before decreasing equity
      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.standby).to.equal(0);
      expect(before.underlying).to.equal(UNDERLYING_AMOUNT);
      expect(before.collateral).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(EQUITY_AMOUNT);
      expect(before.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY));

      // Decrease equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        BigNumber.from(0).sub(UNDERLYING_AMOUNT.div(2)),
        BigNumber.from(0).sub(EQUITY_AMOUNT.div(2))
      );

      // Expect balances to be updated
      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.standby).to.equal(UNDERLYING_AMOUNT.div(2));
      expect(after.underlying).to.equal(UNDERLYING_AMOUNT.div(2));
      expect(after.collateral).to.equal(0);
      expect(after.debt).to.equal(0);
      expect(after.equity).to.equal(EQUITY_AMOUNT.div(2));
      expect(after.initialEquity).to.equal(EQUITY_AMOUNT.div(2).mul(RAY));
    });

    it("updates equity when the accumulators are greater than the initial value", async () => {
      const COLLATERAL_AMOUNT = UNDERLYING_AMOUNT.div(2); // 5000 FLR
      const DEBT_AMOUNT = EQUITY_AMOUNT.div(2); // 1000 USD

      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");

      // Add more standby FLR to wallet (20,000 total)
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, STANDBY_AMOUNT);

      // Increase equity (underlying = 10,000, equity = 2000)
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      // Increase debt (collateral = 5000, debt = 1000)
      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT
      );

      // Update accumulators
      await registry
        .connect(gov)
        .setupAddress(bytes32("teller"), user.address, true);
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      // Expect balances to be updated
      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.standby).to.equal(STANDBY_AMOUNT.div(2));
      expect(before.underlying).to.equal(UNDERLYING_AMOUNT);
      expect(before.collateral).to.equal(COLLATERAL_AMOUNT);
      expect(before.debt).to.equal(DEBT_AMOUNT);
      expect(before.equity).to.equal(EQUITY_AMOUNT);
      expect(before.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY));

      // Increase equity (5000 underlying, 1000 equity)
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      // Expect balances to be updated
      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.standby).to.equal(0);
      expect(after.underlying).to.equal(UNDERLYING_AMOUNT.mul(3).div(2));
      expect(after.collateral).to.equal(COLLATERAL_AMOUNT);
      expect(after.debt).to.equal(DEBT_AMOUNT);
      expect(
        after.initialEquity.gt(EQUITY_AMOUNT.mul(RAY).mul(3).div(2))
      ).to.equal(true);
      expect(after.equity).to.equal(EQUITY_AMOUNT.mul(3).div(2));
    });

    it("fails if equity net asset value is below $1", async () => {
      // Underlying is set to 2000
      const MINIMUM_AMOUNT = EQUITY_AMOUNT;

      // Increase equity (expect revert)
      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          MINIMUM_AMOUNT.sub(1),
          EQUITY_AMOUNT
        ),
        "Vault/certify: Not enough underlying"
      );

      // Increase equity
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        MINIMUM_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("adds a new user to the user list", async () => {
      const before = await vaultEngine.getVaultList();
      expect(before.length).to.equal(0);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      const after = await vaultEngine.getVaultList();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(owner.address);
    });

    it("doesn't add existing users to the user list", async () => {
      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const before = await vaultEngine.getVaultList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const after = await vaultEngine.getVaultList();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(owner.address);
    });

    it("increases the user's initial equity", async () => {
      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY).div(2));
    });
  });

  describe("initAsset Unit Tests", function () {
    it("fails if the caller is not gov", async () => {
      const ASSET_ID = bytes32("new Asset ");
      await assertRevert(
        vaultEngine.connect(user).initAsset(ASSET_ID, 2),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("gov"), user.address, true);

      await vaultEngine.connect(user).initAsset(ASSET_ID, 2);
    });
  });

  describe("addStablecoin Unit Tests", function () {
    const AMOUNT_TO_ADD = RAD.mul(173);

    it("fails if the caller is not treasury", async () => {
      await assertRevert(
        vaultEngine.connect(user).addStablecoin(user.address, AMOUNT_TO_ADD),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("treasury"), user.address, true);

      await vaultEngine
        .connect(user)
        .addStablecoin(user.address, AMOUNT_TO_ADD);
    });

    it("test that correct amount is added", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("treasury"), user.address, true);

      const before = await vaultEngine.systemCurrency(user.address);

      await vaultEngine
        .connect(user)
        .addStablecoin(user.address, AMOUNT_TO_ADD);

      const after = await vaultEngine.systemCurrency(user.address);
      expect(after.sub(before)).to.equal(AMOUNT_TO_ADD);
    });
  });

  describe("reducePbt Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const ASSET_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    const debtRateIncrease = RAY.mul(40);
    const equityRateIncrease = RAY.mul(15);

    beforeEach(async function () {
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);

      await vaultEngine.connect(gov).updateAdjustedPrice(ASSET_ID.FLR, RAY);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, ASSET_AMOUNT.mul(2));

      await vaultEngine
        .connect(owner)
        .modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        );

      await vaultEngine
        .connect(owner)
        .modifyDebt(ASSET_ID.FLR, treasury.address, ASSET_AMOUNT, DEBT_AMOUNT);

      await registry
        .connect(gov)
        .setupAddress(bytes32("teller"), assetManager.address, true);

      await vaultEngine
        .connect(assetManager)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      await vaultEngine.connect(owner).collectInterest(ASSET_ID.FLR);
    });

    it("fails if the caller is not treasury", async () => {
      const AMOUNT_TO_REDUCE = RAD.mul(23);

      await assertRevert(
        vaultEngine.connect(user).reducePbt(owner.address, AMOUNT_TO_REDUCE),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("treasury"), user.address, true);

      await vaultEngine
        .connect(user)
        .reducePbt(owner.address, AMOUNT_TO_REDUCE);
    });

    it("test that correct amount is reduced", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("treasury"), user.address, true);
      const AMOUNT_TO_REDUCE = RAD.mul(23);

      const before = await vaultEngine.pbt(owner.address);
      await vaultEngine
        .connect(user)
        .reducePbt(owner.address, AMOUNT_TO_REDUCE);
      const after = await vaultEngine.pbt(owner.address);

      expect(before.sub(after)).to.equal(AMOUNT_TO_REDUCE);
    });
  });

  describe("balanceOf Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const ACCUMULATOR = RAY;
    const ADJUSTED_PRICE = RAY;
    const ASSET_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);

      await vaultEngine.connect(gov).updateAdjustedPrice(ASSET_ID.FLR, RAY);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, ASSET_AMOUNT);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, user.address, ASSET_AMOUNT);

      await vaultEngine
        .connect(user)
        .modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        );
    });

    it("test that balanceOf returns correct info", async () => {
      const before = await vaultEngine.balanceOf(ASSET_ID.FLR, owner.address);
      expect(before.collateral).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(0);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.balanceOf(ASSET_ID.FLR, owner.address);
      expect(after.collateral).to.equal(ASSET_AMOUNT.mul(ADJUSTED_PRICE));
      expect(after.debt).to.equal(DEBT_AMOUNT.mul(ACCUMULATOR));
      expect(after.equity).to.equal(0);
    });
  });

  describe("modifyDebt Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const COLLATERAL_AMOUNT = WAD.mul(10_000);
    const ASSET_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, ASSET_AMOUNT);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, user.address, ASSET_AMOUNT);

      await vaultEngine
        .connect(user)
        .modifyEquity(
          ASSET_ID.FLR,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        );
    });

    it("fails if treasury address provided is not registered as treasury", async () => {
      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          user.address,
          COLLATERAL_AMOUNT,
          DEBT_AMOUNT
        ),
        "Vault/modifyDebt: Treasury address is not valid"
      );

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("fails if treasury address doesn't have enough capital", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("treasury"), user.address, true);

      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          user.address,
          COLLATERAL_AMOUNT,
          DEBT_AMOUNT
        ),
        "Vault/modifyDebt: Treasury doesn't have enough equity to loan this amount"
      );

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("fails if debt ceiling has been reached", async () => {
      const NEW_CEILING = RAD.mul(1000);
      await vaultEngine.connect(gov).updateCeiling(ASSET_ID.FLR, NEW_CEILING);

      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          treasury.address,
          COLLATERAL_AMOUNT,
          DEBT_AMOUNT.add(1)
        ),
        "Vault/modifyDebt: Debt ceiling reached"
      );

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT.sub(1)
      );
    });

    it("only allows whitelisted users to call modifyDebt", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address, false);
      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          treasury.address,
          COLLATERAL_AMOUNT,
          DEBT_AMOUNT
        ),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address, false);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("fails if the debt amount is below the minimum (floor)", async () => {
      const FLOOR_AMOUNT = RAD.mul(800);
      const DEBT_AMOUNT_UNDER_FLOOR = FLOOR_AMOUNT.div(RAY).sub(1);

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address, false);

      await vaultEngine.connect(gov).updateFloor(ASSET_ID.FLR, FLOOR_AMOUNT);

      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          treasury.address,
          COLLATERAL_AMOUNT,
          DEBT_AMOUNT_UNDER_FLOOR
        ),
        "Vault/modifyDebt: Debt smaller than floor"
      );

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("updates balances when called with positive values", async () => {
      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.standby).to.equal(COLLATERAL_AMOUNT);
      expect(before.collateral).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.standby).to.equal(COLLATERAL_AMOUNT.sub(ASSET_AMOUNT));
      expect(after.collateral).to.equal(ASSET_AMOUNT);
      expect(after.debt).to.equal(DEBT_AMOUNT);
      expect(after.equity).to.equal(0);
      expect(after.initialEquity).to.equal(0);
    });

    it("fails if debt balance goes below zero when called with negative values", async () => {
      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          treasury.address,
          BigNumber.from(0).sub(ASSET_AMOUNT),
          BigNumber.from(0).sub(DEBT_AMOUNT.add(1))
        ),
        "reverted with reason string 'Math/add: add op failed"
      );

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        BigNumber.from(0).sub(ASSET_AMOUNT),
        BigNumber.from(0).sub(DEBT_AMOUNT)
      );
    });

    it("allows debt repayment", async () => {
      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.standby).to.equal(COLLATERAL_AMOUNT.sub(ASSET_AMOUNT));
      expect(before.collateral).to.equal(ASSET_AMOUNT);
      expect(before.debt).to.equal(DEBT_AMOUNT);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        BigNumber.from(0).sub(ASSET_AMOUNT.div(2)),
        BigNumber.from(0).sub(DEBT_AMOUNT.div(2))
      );

      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.standby).to.equal(
        COLLATERAL_AMOUNT.sub(ASSET_AMOUNT.div(2))
      );
      expect(after.collateral).to.equal(ASSET_AMOUNT.div(2));
      expect(after.debt).to.equal(DEBT_AMOUNT.div(2));
      expect(after.equity).to.equal(0);
      expect(after.initialEquity).to.equal(0);
    });

    it("fails if debt position is undercollateralized", async () => {
      const MINIMUM_AMOUNT = DEBT_AMOUNT;
      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,
          treasury.address,
          MINIMUM_AMOUNT.sub(1),
          DEBT_AMOUNT
        ),
        "Vault/certify: Not enough collateral"
      );

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        MINIMUM_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("updates balances when the accumulators are above the initial values", async () => {
      const ASSET_AMOUNT = COLLATERAL_AMOUNT.div(2);
      const DEBT_AMOUNT = EQUITY_AMOUNT.div(2);

      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, COLLATERAL_AMOUNT);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      // Update accumulators
      await registry
        .connect(gov)
        .setupAddress(bytes32("teller"), user.address, true);
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.standby).to.equal(COLLATERAL_AMOUNT.mul(3).div(2));
      expect(before.collateral).to.equal(COLLATERAL_AMOUNT.div(2));
      expect(before.debt).to.equal(DEBT_AMOUNT);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        COLLATERAL_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.standby).to.equal(COLLATERAL_AMOUNT);
      expect(after.collateral).to.equal(COLLATERAL_AMOUNT);
      expect(after.debt).to.equal(DEBT_AMOUNT.mul(3).div(2));
      expect(after.initialEquity).to.equal(0);
      expect(after.equity).to.equal(0);
    });

    it("adds a new user to the user list", async () => {
      const before = await vaultEngine.getVaultList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.getVaultList();
      expect(after.length).to.equal(2);
      expect(after[1]).to.equal(owner.address);
    });

    it("doesn't add existing users to the user list", async () => {
      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const before = await vaultEngine.getVaultList();
      expect(before.length).to.equal(2);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const after = await vaultEngine.getVaultList();
      expect(after.length).to.equal(2);
      expect(after[1]).to.equal(owner.address);
    });
  });

  describe("collectInterest Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const COLL_AMOUNT = WAD.mul(10000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);
    const DEBT_TO_RAISE = BigNumber.from("251035088626883475473007");
    const EQUITY_TO_RAISE = BigNumber.from("125509667994754929166541");

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, owner.address, COLL_AMOUNT);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID.FLR, user.address, COLL_AMOUNT);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
      await vaultEngine
        .connect(user)
        .modifyDebt(ASSET_ID.FLR, treasury.address, COLL_AMOUNT, DEBT_AMOUNT);

      await registry
        .connect(gov)
        .setupAddress(bytes32("teller"), user.address, true);

      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          DEBT_TO_RAISE,
          EQUITY_TO_RAISE,
          BigNumber.from(0)
        );
    });

    it("increases the PBT balance", async () => {
      const EXPECTED_VALUE = EQUITY_TO_RAISE.mul(EQUITY_AMOUNT);

      const before = await vaultEngine.pbt(owner.address);
      expect(before).to.equal(0);
      await vaultEngine.collectInterest(ASSET_ID.FLR);

      const after = await vaultEngine.pbt(owner.address);
      expect(after).to.equal(EXPECTED_VALUE);
    });

    it("increases stablecoin balance", async () => {
      const EXPECTED_VALUE = EQUITY_TO_RAISE.mul(EQUITY_AMOUNT);

      const before = await vaultEngine.systemCurrency(owner.address);
      expect(before).to.equal(0);
      await vaultEngine.collectInterest(ASSET_ID.FLR);

      const after = await vaultEngine.systemCurrency(owner.address);
      expect(after).to.equal(EXPECTED_VALUE);
    });

    it("reduces the equity balance", async () => {
      const ACCUMULATOR = RAY.add(EQUITY_TO_RAISE);
      const EXPECTED_VALUE = EQUITY_AMOUNT.sub(
        EQUITY_TO_RAISE.mul(EQUITY_AMOUNT).div(ACCUMULATOR)
      );

      const before = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(before.equity).to.equal(EQUITY_AMOUNT);
      await vaultEngine.collectInterest(ASSET_ID.FLR);

      const after = await vaultEngine.vaults(ASSET_ID.FLR, owner.address);
      expect(after.equity).to.equal(EXPECTED_VALUE);
    });
  });

  describe("liquidateEquityPosition Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const ASSET_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(
          ASSET_ID.FLR,
          owner.address,
          ASSET_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("liquidator"), user.address, true);
    });

    it("reduces initial equity", async () => {
      const AMOUNT_TO_LIQUIDATE = EQUITY_AMOUNT.div(2); // 1000 FLR
      const before = (await vaultEngine.vaults(ASSET_ID.FLR, owner.address))
        .initialEquity;

      await vaultEngine
        .connect(user)
        .liquidateEquityPosition(
          ASSET_ID.FLR,
          owner.address,
          auctioneer.address,
          0,
          0,
          BigNumber.from("0").sub(AMOUNT_TO_LIQUIDATE),
          BigNumber.from("0").sub(EQUITY_AMOUNT.mul(RAY))
        );

      const after = (await vaultEngine.vaults(ASSET_ID.FLR, owner.address))
        .initialEquity;

      expect(after.sub(before).abs()).to.equal(EQUITY_AMOUNT.mul(RAY));
    });

    it("tests that lendingPoolEquity is lowered properly", async () => {
      const AMOUNT_TO_LIQUIDATE = EQUITY_AMOUNT.div(2); // 1000 FLR
      const before = await vaultEngine.lendingPoolEquity();

      await vaultEngine
        .connect(user)
        .liquidateEquityPosition(
          ASSET_ID.FLR,
          owner.address,
          auctioneer.address,
          0,
          0,
          BigNumber.from("0").sub(AMOUNT_TO_LIQUIDATE),
          EQUITY_AMOUNT
        );

      const after = await vaultEngine.lendingPoolEquity();
      expect(after.sub(before).abs()).to.equal(AMOUNT_TO_LIQUIDATE);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const ASSET_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(
          ASSET_ID.FLR,
          owner.address,
          ASSET_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("teller"), user.address, true);
    });

    it("only allows teller to update rate accumulators", async () => {
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");

      await assertRevert(
        vaultEngine.updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        ),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );
    });

    it("updates the debt and equity accumulators", async () => {
      const debtAccuBefore = await vaultEngine.debtAccumulator();
      const equityAccuBefore = await vaultEngine.equityAccumulator();
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const debtAccuAfter = await vaultEngine.debtAccumulator();
      const equityAccuAfter = await vaultEngine.equityAccumulator();
      expect(debtAccuBefore.add(debtRateIncrease)).to.equal(debtAccuAfter);
      expect(equityAccuBefore.add(equityRateIncrease)).to.equal(
        equityAccuAfter
      );
    });

    it("updates total debt and total equity", async () => {
      const totalDebtBefore = await vaultEngine.lendingPoolDebt();
      const lendingPoolEquityBefore = await vaultEngine.lendingPoolEquity();

      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const totalDebtAfter = await vaultEngine.lendingPoolDebt();
      const lendingPoolEquityAfter = await vaultEngine.lendingPoolEquity();

      expect(totalDebtAfter.sub(totalDebtBefore).gte(0)).to.equal(true);
      expect(
        lendingPoolEquityAfter.sub(lendingPoolEquityBefore).gte(0)
      ).to.equal(true);
    });

    it("fails if the equity increase is larger than the debt increase", async () => {
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      let equityRateIncrease = debtRateIncrease.add(1);
      await assertRevert(
        vaultEngine
          .connect(user)
          .updateAccumulators(
            ASSET_ID.FLR,
            reservePool.address,
            debtRateIncrease,
            equityRateIncrease,
            BigNumber.from(0)
          ),
        "VaultEngine/updateAccumulators: The equity rate increase is larger than the debt rate increase"
      );

      equityRateIncrease = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );
    });

    it("fails if the equity increase (+ protocol fee) is larger than the debt increase", async () => {
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");
      let protocolRateIncrease = BigNumber.from("25509667994754929166541");
      await assertRevert(
        vaultEngine
          .connect(user)
          .updateAccumulators(
            ASSET_ID.FLR,
            reservePool.address,
            debtRateIncrease,
            equityRateIncrease,
            protocolRateIncrease
          ),
        "VaultEngine/updateAccumulators: The equity rate increase is larger than the debt rate increase"
      );

      protocolRateIncrease = BigNumber.from(0);

      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          protocolRateIncrease
        );
    });

    it("adds the protocol fee to the reserve pool", async () => {
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const protocolFee = BigNumber.from("21035088626883475473007");
      const equityRateIncrease = debtRateIncrease.div(2).sub(protocolFee);

      const EXPECTED_AMOUNT = protocolFee.mul(EQUITY_AMOUNT);

      const reserveStablesBefore = await vaultEngine.systemCurrency(
        reservePool.address
      );
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          ASSET_ID.FLR,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          protocolFee
        );

      const reserveStablesAfter = await vaultEngine.systemCurrency(
        reservePool.address
      );
      expect(reserveStablesAfter.sub(reserveStablesBefore)).to.equal(
        EXPECTED_AMOUNT
      );
    });
  });
});
