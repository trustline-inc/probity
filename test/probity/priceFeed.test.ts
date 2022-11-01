import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  FtsoLike,
  MockFtso,
  MockVaultEngine,
  PriceFeed,
  Registry,
} from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import {
  ADDRESS_ZERO,
  ASSET_ID,
  bytes32,
  BYTES32_ZERO,
  RAY,
  WAD,
} from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import parseEvents from "../utils/parseEvents";
import { BigNumber } from "ethers";
import { rdiv } from "../utils/math";
const expect = chai.expect;

// Wallets
let user: SignerWithAddress;
let gov: SignerWithAddress;

// Contracts
let registry: Registry;
let priceFeed: PriceFeed;
let ftso: MockFtso;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("PriceFeed Unit Tests", function () {
  const ASSET_ID = bytes32("asset name");
  const DEFAULT_LIQUIDATION_RATIO = WAD.mul(15).div(10);
  const CONTRACT_NAME = bytes32("priceFeed");

  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;
    priceFeed = contracts.priceFeed!;
    ftso = contracts.ftso!;

    gov = signers.owner!;
    user = signers.alice!;
  });

  describe("initAsset Unit Tests", function () {
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        priceFeed
          .connect(user)
          .initAsset(ASSET_ID, DEFAULT_LIQUIDATION_RATIO, ftso.address),
        "callerDoesNotHaveRequiredRole"
      );
      await priceFeed
        .connect(gov)
        .initAsset(ASSET_ID, DEFAULT_LIQUIDATION_RATIO, ftso.address);
    });

    it("fails if the asset has already been initialized", async () => {
      const DIFF_ASSET_ID = bytes32("different asset");

      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );
      await assertRevert(
        priceFeed.initAsset(ASSET_ID, DEFAULT_LIQUIDATION_RATIO, ftso.address),
        "assetAlreadyInitialized()"
      );

      await priceFeed.initAsset(
        DIFF_ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );
    });

    it("tests that all the variables are properly initialized", async () => {
      const assetBefore = await priceFeed.assets(ASSET_ID);
      expect(assetBefore.liquidationRatio.toNumber()).to.equal(0);
      expect(assetBefore.ftso).to.equal(ADDRESS_ZERO);

      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );

      const assetAfter = await priceFeed.assets(ASSET_ID);
      expect(assetAfter.liquidationRatio).to.equal(DEFAULT_LIQUIDATION_RATIO);
      expect(assetAfter.ftso).to.equal(ftso.address);
    });
  });

  describe("updateLiquidationRatio Unit Tests", function () {
    const NEW_LIQUIDATION_RATIO = DEFAULT_LIQUIDATION_RATIO.div(2);
    beforeEach(async function () {
      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );
    });

    it("fails if caller is not by gov", async () => {
      await assertRevert(
        priceFeed
          .connect(user)
          .updateLiquidationRatio(ASSET_ID, NEW_LIQUIDATION_RATIO),
        "callerDoesNotHaveRequiredRole"
      );
      await priceFeed
        .connect(gov)
        .updateLiquidationRatio(ASSET_ID, NEW_LIQUIDATION_RATIO);
    });

    it("tests that all the variables are properly updated ", async () => {
      const assetBefore = await priceFeed.assets(ASSET_ID);
      expect(assetBefore.liquidationRatio).to.equal(DEFAULT_LIQUIDATION_RATIO);
      expect(assetBefore.ftso).to.equal(ftso.address);

      await priceFeed.updateLiquidationRatio(ASSET_ID, NEW_LIQUIDATION_RATIO);

      const assetAfter = await priceFeed.assets(ASSET_ID);
      expect(assetAfter.liquidationRatio).to.equal(NEW_LIQUIDATION_RATIO);
      expect(assetAfter.ftso).to.equal(ftso.address);
    });

    it("tests that LogVarUpdate is emitted correctly", async () => {
      const VARIABLE_NAME = bytes32("liquidationRatio");

      const events = await parseEvents(
        priceFeed.updateLiquidationRatio(ASSET_ID, NEW_LIQUIDATION_RATIO),
        "LogVarUpdate",
        priceFeed
      );

      expect(events.length).to.equal(1);
      expect(events[0].args.contractName).to.equal(CONTRACT_NAME);
      expect(events[0].args.assetId).to.equal(ASSET_ID);
      expect(events[0].args.variable).to.equal(VARIABLE_NAME);
      expect(events[0].args.oldValue).to.equal(DEFAULT_LIQUIDATION_RATIO);
      expect(events[0].args.newValue).to.equal(NEW_LIQUIDATION_RATIO);
    });
  });

  describe("updateFtso Unit Tests", function () {
    beforeEach(async function () {
      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );
    });

    it("fails if caller is not by gov", async () => {
      const NEW_FTSO_ADDRESS = user.address;

      await assertRevert(
        priceFeed.connect(user).updateFtso(ASSET_ID, NEW_FTSO_ADDRESS),
        "callerDoesNotHaveRequiredRole"
      );
      await priceFeed.connect(gov).updateFtso(ASSET_ID, NEW_FTSO_ADDRESS);
    });

    it("tests that all the variables are properly updated ", async () => {
      const NEW_FTSO_ADDRESS = user.address;

      const assetBefore = await priceFeed.assets(ASSET_ID);
      expect(assetBefore.liquidationRatio).to.equal(DEFAULT_LIQUIDATION_RATIO);
      expect(assetBefore.ftso).to.equal(ftso.address);

      await priceFeed.updateFtso(ASSET_ID, NEW_FTSO_ADDRESS);

      const assetAfter = await priceFeed.assets(ASSET_ID);
      expect(assetAfter.liquidationRatio).to.equal(DEFAULT_LIQUIDATION_RATIO);
      expect(assetAfter.ftso).to.equal(NEW_FTSO_ADDRESS);
    });

    it("tests that LogVarUpdate is emitted correctly", async () => {
      const NEW_FTSO_ADDRESS = user.address;

      const VARIABLE_NAME = bytes32("ftso");

      const events = await parseEvents(
        priceFeed.updateFtso(ASSET_ID, NEW_FTSO_ADDRESS),
        "LogVarUpdate",
        priceFeed
      );

      expect(events.length).to.equal(1);
      expect(events[0].args.contractName).to.equal(CONTRACT_NAME);
      expect(events[0].args.assetId).to.equal(ASSET_ID);
      expect(events[0].args.variable).to.equal(VARIABLE_NAME);
      expect(events[0].args.oldValue).to.equal(ftso.address);
      expect(events[0].args.newValue).to.equal(NEW_FTSO_ADDRESS);
    });
  });

  describe("getPrice Unit Tests", function () {
    const CURRENT_PRICE_TO_SET = BigNumber.from(1e5).mul(3).div(10);
    beforeEach(async function () {
      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );
      await ftso.setCurrentPrice(CURRENT_PRICE_TO_SET);
    });

    it("tests that get price returned in correct precision", async () => {
      const EXPECTED_PRICE = rdiv(CURRENT_PRICE_TO_SET, BigNumber.from(1e5));
      const price = await priceFeed.callStatic.getPrice(ASSET_ID);
      expect(price).to.equal(EXPECTED_PRICE);
    });
  });

  describe("updateAdjustedPrice Unit Tests", function () {
    const CURRENT_PRICE_TO_SET = BigNumber.from(1e5).mul(3).div(10);
    let vaultEngine: MockVaultEngine;

    beforeEach(async function () {
      let { contracts, signers } = await deployTest();
      // Set contracts
      registry = contracts.registry!;
      ftso = contracts.ftso!;
      vaultEngine = contracts.mockVaultEngine!;

      const res = await probity.deployPriceFeed({
        registry: contracts.registry?.address,
        vaultEngine: contracts.mockVaultEngine?.address,
      });
      priceFeed = res.priceFeed!;

      await ftso.setCurrentPrice(CURRENT_PRICE_TO_SET);
    });

    it("fails if asset has not been initialized", async () => {
      await assertRevert(
        priceFeed.updateAdjustedPrice(ASSET_ID),
        "assetNotInitialized()"
      );
      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );
      await priceFeed.updateAdjustedPrice(ASSET_ID);
    });

    it("fails when contract is in paused state", async () => {
      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );

      await priceFeed.setState(bytes32("paused"), true);
      await assertRevert(
        priceFeed.updateAdjustedPrice(ASSET_ID),
        "stateCheckFailed"
      );

      await priceFeed.setState(bytes32("paused"), false);
      await priceFeed.updateAdjustedPrice(ASSET_ID);
    });

    it("tests that vaultEngine's updateAdjustedPrice is called properly", async () => {
      const EXPECTED_PRICE = rdiv(CURRENT_PRICE_TO_SET, BigNumber.from(1e5));
      const EXPECTED_ADJUSTED_PRICE = rdiv(
        EXPECTED_PRICE,
        DEFAULT_LIQUIDATION_RATIO.mul(1e9)
      );

      await priceFeed.initAsset(
        ASSET_ID,
        DEFAULT_LIQUIDATION_RATIO,
        ftso.address
      );

      const assetBefore = await vaultEngine.assets(ASSET_ID);
      expect(assetBefore.adjustedPrice).to.equal(0);

      await priceFeed.updateAdjustedPrice(ASSET_ID);

      const assetAfter = await vaultEngine.assets(ASSET_ID);
      expect(assetAfter.adjustedPrice).to.equal(EXPECTED_ADJUSTED_PRICE);
    });
  });
});
