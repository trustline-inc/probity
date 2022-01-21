import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  MockFtso,
  NativeToken,
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
import { bytes32, RAD, WAD, RAY } from "../utils/constants";
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
let nativeToken: NativeToken;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

let flrAssetId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.vaultEngine;
    reservePool = contracts.reservePool;
    nativeToken = contracts.nativeToken;
    teller = contracts.teller;
    priceFeed = contracts.priceFeed;
    ftso = contracts.ftso;
    treasury = contracts.treasury;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    assetManager = signers.don;

    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry.setupAddress(bytes32("whitelisted"), user.address);
    await registry.setupAddress(bytes32("whitelisted"), owner.address);
  });

  describe("modifyEquity Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const EQUITY_AMOUNT = WAD.mul(2000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAssetType(flrAssetId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrAssetId, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, UNDERLYING_AMOUNT);
    });

    it("only allows whitelisted users to call modifyEquity", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address);
      await assertRevert(
        vaultEngine.modifyEquity(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "AccessControl/onlyByWhiteListed: Access forbidden"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("fails if equity amount falls below the minimum (floor)", async () => {
      const FLOOR_AMOUNT = RAD.mul(1000);
      const EQUITY_AMOUNT_UNDER_FLOOR = FLOOR_AMOUNT.div(RAY).sub(1);
      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address);

      await vaultEngine.connect(gov).updateFloor(flrAssetId, FLOOR_AMOUNT);

      await assertRevert(
        vaultEngine.modifyEquity(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT_UNDER_FLOOR
        ),
        "Vault/modifyEquity: Equity smaller than floor"
      );

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("tests that values are properly updated when calling with positive values", async () => {
      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standbyAssetAmount).to.equal(UNDERLYING_AMOUNT);
      expect(before.activeAssetAmount).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.standbyAssetAmount).to.equal(0);
      expect(after.activeAssetAmount).to.equal(UNDERLYING_AMOUNT);
      expect(after.debt).to.equal(0);
      expect(after.equity).to.equal(EQUITY_AMOUNT);
      expect(after.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY));
    });

    it("fails if vault debt balances goes under zero when calling with negative values", async () => {
      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyEquity(
          flrAssetId,
          treasury.address,
          BigNumber.from(0).sub(UNDERLYING_AMOUNT),
          BigNumber.from(0).sub(EQUITY_AMOUNT.add(1))
        ),
        "reverted with reason string 'Vault/add: add op failed"
      );

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        BigNumber.from(0).sub(UNDERLYING_AMOUNT),
        BigNumber.from(0).sub(EQUITY_AMOUNT)
      );
    });

    it("tests that values are properly updated when calling with negative values", async () => {
      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standbyAssetAmount).to.equal(0);
      expect(before.activeAssetAmount).to.equal(UNDERLYING_AMOUNT);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(EQUITY_AMOUNT);
      expect(before.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY));

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        BigNumber.from(0).sub(UNDERLYING_AMOUNT.div(2)),
        BigNumber.from(0).sub(EQUITY_AMOUNT.div(2))
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.standbyAssetAmount).to.equal(UNDERLYING_AMOUNT.div(2));
      expect(after.activeAssetAmount).to.equal(UNDERLYING_AMOUNT.div(2));
      expect(after.debt).to.equal(0);
      expect(after.equity).to.equal(EQUITY_AMOUNT.div(2));
      expect(after.initialEquity).to.equal(EQUITY_AMOUNT.div(2).mul(RAY));
    });

    it("tests that equity is updated properly when accumulator is above initial", async () => {
      const ASSET_AMOUNT = UNDERLYING_AMOUNT.div(2);
      const DEBT_AMOUNT = EQUITY_AMOUNT.div(2);

      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, UNDERLYING_AMOUNT);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      // update accumulator
      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);

      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standbyAssetAmount).to.equal(UNDERLYING_AMOUNT.div(2));
      expect(before.activeAssetAmount).to.equal(
        UNDERLYING_AMOUNT.mul(3).div(2)
      );
      expect(before.debt).to.equal(DEBT_AMOUNT);
      expect(before.equity).to.equal(EQUITY_AMOUNT);
      expect(before.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY));

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.standbyAssetAmount).to.equal(0);
      expect(after.activeAssetAmount).to.equal(UNDERLYING_AMOUNT.mul(2));
      expect(after.debt).to.equal(DEBT_AMOUNT);
      expect(
        after.initialEquity.gt(EQUITY_AMOUNT.mul(RAY).mul(3).div(2))
      ).to.equal(true);
      expect(after.equity).to.equal(EQUITY_AMOUNT.mul(3).div(2));
    });

    it("fails if vault is undercollateralized", async () => {
      const MINIMUM_AMOUNT = EQUITY_AMOUNT;
      await assertRevert(
        vaultEngine.modifyEquity(
          flrAssetId,
          treasury.address,
          MINIMUM_AMOUNT.sub(1),
          EQUITY_AMOUNT
        ),
        "Vault/certify: Not enough underlying/collateral"
      );

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        MINIMUM_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("adds a new user to the user list", async () => {
      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(0);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(owner.address);
    });

    it("doesn't add existing users to the user list", async () => {
      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(owner.address);
    });

    it("initialEquity is added properly", async () => {
      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        EQUITY_AMOUNT.div(2)
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.initialEquity).to.equal(EQUITY_AMOUNT.mul(RAY).div(2));
    });
  });

  describe("modifyDebt Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const ASSET_AMOUNT = WAD.mul(10000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAssetType(flrAssetId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrAssetId, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, ASSET_AMOUNT);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, user.address, ASSET_AMOUNT);

      await vaultEngine
        .connect(user)
        .modifyEquity(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        );
    });

    it("only allows whitelisted users to call modifyDebt", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address);
      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          ASSET_AMOUNT,
          DEBT_AMOUNT
        ),
        "AccessControl/onlyByWhiteListed: Access forbidden"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("fails if the debt amount is below the minimum (floor)", async () => {
      const FLOOR_AMOUNT = RAD.mul(800);
      const DEBT_AMOUNT_UNDER_FLOOR = FLOOR_AMOUNT.div(RAY).sub(1);

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address);

      await vaultEngine.connect(gov).updateFloor(flrAssetId, FLOOR_AMOUNT);

      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          ASSET_AMOUNT,
          DEBT_AMOUNT_UNDER_FLOOR
        ),
        "Vault/modifyDebt: Debt smaller than floor"
      );

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("tests that values are properly updated when called with positive values", async () => {
      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standbyAssetAmount).to.equal(UNDERLYING_AMOUNT);
      expect(before.activeAssetAmount).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.standbyAssetAmount).to.equal(
        UNDERLYING_AMOUNT.sub(ASSET_AMOUNT)
      );
      expect(after.activeAssetAmount).to.equal(ASSET_AMOUNT);
      expect(after.debt).to.equal(DEBT_AMOUNT);
      expect(after.equity).to.equal(0);
      expect(after.initialEquity).to.equal(0);
    });

    it("fails if vault debt balances goes under zero when calling with negative values", async () => {
      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          BigNumber.from(0).sub(ASSET_AMOUNT),
          BigNumber.from(0).sub(DEBT_AMOUNT.add(1))
        ),
        "reverted with reason string 'Vault/add: add op failed"
      );

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        BigNumber.from(0).sub(ASSET_AMOUNT),
        BigNumber.from(0).sub(DEBT_AMOUNT)
      );
    });

    it("tests that values are properly updated when calling with negative values", async () => {
      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standbyAssetAmount).to.equal(
        UNDERLYING_AMOUNT.sub(ASSET_AMOUNT)
      );
      expect(before.activeAssetAmount).to.equal(ASSET_AMOUNT);
      expect(before.debt).to.equal(DEBT_AMOUNT);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        BigNumber.from(0).sub(ASSET_AMOUNT.div(2)),
        BigNumber.from(0).sub(DEBT_AMOUNT.div(2))
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.standbyAssetAmount).to.equal(
        UNDERLYING_AMOUNT.sub(ASSET_AMOUNT.div(2))
      );
      expect(after.activeAssetAmount).to.equal(ASSET_AMOUNT.div(2));
      expect(after.debt).to.equal(DEBT_AMOUNT.div(2));
      expect(after.equity).to.equal(0);
      expect(after.initialEquity).to.equal(0);
    });

    it("fails if vault is undercollateralized", async () => {
      const MINIMUM_AMOUNT = DEBT_AMOUNT;
      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          MINIMUM_AMOUNT.sub(1),
          DEBT_AMOUNT
        ),
        "Vault/certify: Not enough underlying/collateral"
      );

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        MINIMUM_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("tests that debt is updated properly when accumulator is above initial", async () => {
      const ASSET_AMOUNT = UNDERLYING_AMOUNT.div(2);
      const DEBT_AMOUNT = EQUITY_AMOUNT.div(2);

      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, UNDERLYING_AMOUNT);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      // update accumulator
      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);

      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standbyAssetAmount).to.equal(
        UNDERLYING_AMOUNT.mul(3).div(2)
      );
      expect(before.activeAssetAmount).to.equal(UNDERLYING_AMOUNT.div(2));
      expect(before.debt).to.equal(DEBT_AMOUNT);
      expect(before.equity).to.equal(0);
      expect(before.initialEquity).to.equal(0);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.standbyAssetAmount).to.equal(UNDERLYING_AMOUNT);
      expect(after.activeAssetAmount).to.equal(UNDERLYING_AMOUNT);
      expect(after.debt).to.equal(DEBT_AMOUNT.mul(3).div(2));
      expect(after.initialEquity).to.equal(0);
      expect(after.equity).to.equal(0);
    });

    it("adds a new user to the user list", async () => {
      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(2);
      expect(after[1]).to.equal(owner.address);
    });

    it("doesn't add existing users to the user list", async () => {
      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(2);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const after = await vaultEngine.getUserList();
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
      await vaultEngine.connect(gov).initAssetType(flrAssetId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrAssetId, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, COLL_AMOUNT);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, user.address, COLL_AMOUNT);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
      await vaultEngine
        .connect(user)
        .modifyDebt(flrAssetId, treasury.address, COLL_AMOUNT, DEBT_AMOUNT);

      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);

      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          DEBT_TO_RAISE,
          EQUITY_TO_RAISE,
          BigNumber.from(0)
        );
    });

    it("test that pbt is added properly", async () => {
      const EXPECTED_VALUE = EQUITY_TO_RAISE.mul(EQUITY_AMOUNT);

      const before = await vaultEngine.pbt(owner.address);
      expect(before).to.equal(0);
      await vaultEngine.collectInterest(flrAssetId);

      const after = await vaultEngine.pbt(owner.address);
      expect(after).to.equal(EXPECTED_VALUE);
    });

    it("test that stablecoin is added properly", async () => {
      const EXPECTED_VALUE = EQUITY_TO_RAISE.mul(EQUITY_AMOUNT);

      const before = await vaultEngine.stablecoin(owner.address);
      expect(before).to.equal(0);
      await vaultEngine.collectInterest(flrAssetId);

      const after = await vaultEngine.stablecoin(owner.address);
      expect(after).to.equal(EXPECTED_VALUE);
    });

    it("test that equity is reduced properly", async () => {
      const ACCUMULATOR = RAY.add(EQUITY_TO_RAISE);
      const EXPECTED_VALUE = EQUITY_AMOUNT.sub(
        EQUITY_TO_RAISE.mul(EQUITY_AMOUNT).div(ACCUMULATOR)
      );

      const before = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.equity).to.equal(EQUITY_AMOUNT);
      await vaultEngine.collectInterest(flrAssetId);

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(after.equity).to.equal(EXPECTED_VALUE);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const ASSET_AMOUNT = WAD.mul(10000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const DEBT_AMOUNT = WAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAssetType(flrAssetId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrAssetId, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(
          flrAssetId,
          owner.address,
          ASSET_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        ASSET_AMOUNT,
        DEBT_AMOUNT
      );

      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);
    });

    it("only allows teller to call updateAccumulators", async () => {
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");

      await assertRevert(
        vaultEngine.updateAccumulators(
          flrAssetId,
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
          flrAssetId,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );
    });

    it("updates the debt and equity accumulators", async () => {
      const assetBefore = await vaultEngine.assets(flrAssetId);
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const assetAfter = await vaultEngine.assets(flrAssetId);
      expect(assetBefore.debtAccumulator.add(debtRateIncrease)).to.equal(
        assetAfter.debtAccumulator
      );
      expect(assetBefore.equityAccumulator.add(equityRateIncrease)).to.equal(
        assetAfter.equityAccumulator
      );
    });

    it("updates total debt and total equity", async () => {
      const totalDebtBefore = await vaultEngine.totalDebt();
      const totalEquityBefore = await vaultEngine.totalEquity();

      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      const equityRateIncrease = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          BigNumber.from(0)
        );

      const totalDebtAfter = await vaultEngine.totalDebt();
      const totalEquityAfter = await vaultEngine.totalEquity();

      expect(totalDebtAfter.sub(totalDebtBefore).gte(0)).to.equal(true);
      expect(totalEquityAfter.sub(totalEquityBefore).gte(0)).to.equal(true);
    });

    it("fails if the equity increase is larger than the debt increase", async () => {
      const debtRateIncrease = BigNumber.from("251035088626883475473007");
      let equityRateIncrease = debtRateIncrease.add(1);
      await assertRevert(
        vaultEngine
          .connect(user)
          .updateAccumulators(
            flrAssetId,
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
          flrAssetId,
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
            flrAssetId,
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
          flrAssetId,
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

      const reserveStablesBefore = await vaultEngine.stablecoin(
        reservePool.address
      );
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtRateIncrease,
          equityRateIncrease,
          protocolFee
        );

      const reserveStablesAfter = await vaultEngine.stablecoin(
        reservePool.address
      );
      expect(reserveStablesAfter.sub(reserveStablesBefore)).to.equal(
        EXPECTED_AMOUNT
      );
    });
  });

  describe("updateInflationRate Unit Tests", () => {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const ASSET_AMOUNT = WAD.mul(10000);
    const EQUITY_AMOUNT = RAD.mul(2000);
    const DEBT_AMOUNT = RAD.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAssetType(flrAssetId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrAssetId, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(
          flrAssetId,
          owner.address,
          ASSET_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));
      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);
    });

    it("updates the inflation rate", async () => {
      // Rates are initialized as zero
      let inflationRate = await vaultEngine.inflationRate();
      let aggregateInflationRate = await vaultEngine.aggregateInflationRate();
      expect(inflationRate).to.equal(0);
      expect(aggregateInflationRate).to.equal(0);

      // Rates are updated by gov
      const fiveBP = ethers.utils.parseUnits("0.005", 27); // 5 basis points in RAY
      await vaultEngine.connect(gov).updateInflationRate(fiveBP);
      inflationRate = await vaultEngine.inflationRate();
      aggregateInflationRate = await vaultEngine.aggregateInflationRate();
      expect(inflationRate).to.equal(fiveBP);
      expect(aggregateInflationRate).to.equal(fiveBP);

      // Rates are updated a second time
      await vaultEngine.connect(gov).updateInflationRate(fiveBP);
      aggregateInflationRate = await vaultEngine.aggregateInflationRate();
      expect(inflationRate).to.equal(fiveBP);
      expect(aggregateInflationRate).to.equal(
        ethers.utils.parseUnits("0.01", 27)
      );
    });

    it("updates the underlying and collateral ratios", async () => {
      const fiveBP = ethers.utils.parseUnits("0.005", 27); // 5 basis points in RAY
      await vaultEngine.connect(gov).updateInflationRate(fiveBP);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, UNDERLYING_AMOUNT);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });
  });
});
