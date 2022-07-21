import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { MockVaultEngine, Registry, Teller } from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY, ASSET_ID } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
import { rdiv, rmul, rpow, wdiv } from "../utils/math";
import parseEvents from "../utils/parseEvents";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let teller: Teller;
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePoolAddress: string;

let EQUITY_TO_SET = RAD.mul(2000);
let DEBT_TO_SET = RAD.mul(1000);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Teller Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;

    contracts = await probity.deployTeller({
      vaultEngine: contracts.mockVaultEngine?.address,
    });
    vaultEngine = contracts.mockVaultEngine!;
    reservePoolAddress = contracts.reservePool?.address!;
    teller = contracts.teller!;

    owner = signers.owner!;
    user = signers.alice!;
  });

  describe("setReservePool Unit Tests", function () {
    it("tests that values are properly set", async () => {
      const NEW_RESERVE_POOL_ADDRESS = owner.address;
      const reservePoolBefore = await teller.reservePool();
      expect(reservePoolBefore).to.equal(reservePoolAddress);
      await teller.setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS);
      const reservePoolAfter = await teller.reservePool();
      expect(reservePoolAfter).to.equal(NEW_RESERVE_POOL_ADDRESS);
    });

    it("can only be called by gov address", async () => {
      const NEW_RESERVE_POOL_ADDRESS = owner.address;
      await assertRevert(
        teller.connect(user).setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await teller
        .connect(user)
        .setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS);
    });

    it("tests that LogVarUpdate event is emitted properly", async () => {
      const NEW_RESERVE_POOL_ADDRESS = owner.address;

      let parsedEvents = await parseEvents(
        teller.setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS),
        "LogVarUpdate",
        teller
      );

      expect(parsedEvents[0].args[0]).to.equal(bytes32("teller"));
      expect(parsedEvents[0].args[1]).to.equal(bytes32("reservePool"));
      expect(parsedEvents[0].args[2]).to.equal(reservePoolAddress);
      expect(parsedEvents[0].args[3]).to.equal(NEW_RESERVE_POOL_ADDRESS);
    });
  });

  describe("setProtocolFee Unit Tests", function () {
    beforeEach(async function () {
      await teller.initAsset(ASSET_ID.FLR, 0);
    });

    it("tests that values are properly set", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);
      const collBefore = await teller.assets(ASSET_ID.FLR);
      expect(collBefore.protocolFee).to.equal(0);
      await teller.setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET);
      const collAfter = await teller.assets(ASSET_ID.FLR);
      expect(collAfter.protocolFee).to.not.equal(0);
    });

    it("can only be called by gov address", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);
      await assertRevert(
        teller
          .connect(user)
          .setProtocolFee(bytes32("new coll"), PROTOCOL_FEE_TO_SET),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await teller
        .connect(user)
        .setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET);
    });

    it("tests that LogVarUpdate event is emitted properly", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);

      let parsedEvents = await parseEvents(
        teller.setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET),
        "LogVarUpdate",
        teller
      );

      expect(parsedEvents[0].args[0]).to.equal(bytes32("teller"));
      expect(parsedEvents[0].args[1]).to.equal(ASSET_ID.FLR);
      expect(parsedEvents[0].args[2]).to.equal(bytes32("protocolFee"));
      expect(parsedEvents[0].args[3]).to.equal(0);
      expect(parsedEvents[0].args[4]).to.equal(PROTOCOL_FEE_TO_SET);
    });
  });

  describe("initAsset Unit Tests", function () {
    it("tests that values are properly initialized", async () => {
      const collBefore = await teller.assets(ASSET_ID.FLR);
      expect(collBefore[0]).to.equal(0);
      expect(collBefore[1]).to.equal(0);
      await teller.initAsset(ASSET_ID.FLR, 0);
      const collAfter = await teller.assets(ASSET_ID.FLR);
      expect(collAfter[0]).to.not.equal(0);
      expect(collAfter[1]).to.equal(0);
    });

    it("can only be called by gov address", async () => {
      await assertRevert(
        teller.connect(user).initAsset(bytes32("new coll"), 0),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await teller.connect(user).initAsset(ASSET_ID.FLR, 0);
    });

    it("fails if asset has already been initialized", async () => {
      const assetId = bytes32("new asset");
      await teller.initAsset(assetId, 0);
      await assertRevert(
        teller.initAsset(assetId, 0),
        "Teller/initAsset: This asset has already been initialized"
      );
    });

    it("tests that AssetInitialized event is emitted properly", async () => {
      const PROTOCOL_FEE = WAD.div(10);

      let parsedEvents = await parseEvents(
        teller.initAsset(ASSET_ID.FLR, PROTOCOL_FEE),
        "AssetInitialized",
        teller
      );

      expect(parsedEvents[0].args[0]).to.equal(ASSET_ID.FLR);
      expect(parsedEvents[0].args[1]).to.equal(PROTOCOL_FEE);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    beforeEach(async function () {
      await teller.initAsset(ASSET_ID.FLR, 0);
      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await vaultEngine.setTotalUserDebt(DEBT_TO_SET);
      await vaultEngine.setTotalEquity(EQUITY_TO_SET);
    });

    it("fails if collType has not been initialized", async () => {
      const newCollId = bytes32("new coll");
      await assertRevert(
        teller.updateAccumulators(newCollId),
        "Teller/updateAccumulators: Asset not initialized"
      );
      await teller.initAsset(newCollId, 0);
      await teller.updateAccumulators(newCollId);
    });

    it("fail if lendingPoolEquity is 0", async () => {
      await vaultEngine.setTotalEquity(0);
      await assertRevert(
        teller.updateAccumulators(ASSET_ID.FLR),
        "Teller/updateAccumulators: Total equity cannot be zero"
      );
      await vaultEngine.setTotalEquity(EQUITY_TO_SET);

      await teller.updateAccumulators(ASSET_ID.FLR);
    });

    it("tests that APR is set properly", async () => {
      await vaultEngine.setTotalUserDebt(RAD.mul(25));
      await vaultEngine.setTotalEquity(RAD.mul(100));

      await teller.updateAccumulators(ASSET_ID.FLR);
      let apr = await teller.apr();
      expect(apr).to.equal("1015000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(50));
      await vaultEngine.setTotalEquity(RAD.mul(100));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("1020000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(75));
      await vaultEngine.setTotalEquity(RAD.mul(100));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("1040000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(90));
      await vaultEngine.setTotalEquity(RAD.mul(100));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("1100000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(95));
      await vaultEngine.setTotalEquity(RAD.mul(100));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("1200000000000000000000000000");
    });

    it("tests that APR won't go over MAX_APR", async () => {
      await vaultEngine.setTotalUserDebt(RAD.mul(990));
      await vaultEngine.setTotalEquity(RAD.mul(1000));

      await teller.updateAccumulators(ASSET_ID.FLR);
      let apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(995));
      await vaultEngine.setTotalEquity(RAD.mul(1000));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(1000));
      await vaultEngine.setTotalEquity(RAD.mul(1000));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalUserDebt(RAD.mul(1100));
      await vaultEngine.setTotalEquity(RAD.mul(1000));

      await teller.updateAccumulators(ASSET_ID.FLR);
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");
    });

    it("tests that debtAccumulator is calculated properly", async () => {
      const DEFAULT_DEBT_ACCUMULATOR = RAY;
      let TIME_TO_INCREASE = 400000;

      await teller.updateAccumulators(ASSET_ID.FLR);
      let vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
      let mpr = await teller.mpr();

      let lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
      const before = await vaultEngine.assets(ASSET_ID.FLR);
      expect(before[0]).to.equal(DEFAULT_DEBT_ACCUMULATOR);

      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators(ASSET_ID.FLR);
      let lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];

      let EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore)),
        vaultColl[0]
      );

      let after = await vaultEngine.assets(ASSET_ID.FLR);
      expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);

      vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
      mpr = await teller.mpr();
      TIME_TO_INCREASE = 23000;

      lastUpdatedBefore = lastUpdatedAfter;
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators(ASSET_ID.FLR);

      lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];

      EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore)),
        vaultColl[0]
      );

      after = await vaultEngine.assets(ASSET_ID.FLR);
      expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);
    });

    it("tests that suppAccumulator is calculated properly", async () => {
      const DEFAULT_SUPP_ACCUMULATOR = RAY;
      let TIME_TO_INCREASE = 400000;

      await teller.updateAccumulators(ASSET_ID.FLR);

      let vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
      let lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
      let before = await vaultEngine.assets(ASSET_ID.FLR);
      expect(before[1]).to.equal(DEFAULT_SUPP_ACCUMULATOR);
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators(ASSET_ID.FLR);

      let lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
      let mpr = await teller.mpr();
      let totalDebt = await vaultEngine.lendingPoolDebt();
      let lendingPoolEquity = await vaultEngine.lendingPoolEquity();
      let utilitization = wdiv(totalDebt, lendingPoolEquity);
      let multipledByUtilization = rmul(mpr.sub(RAY), utilitization.mul(1e9));
      let exponentiated = rpow(
        multipledByUtilization.add(RAY),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );

      let EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);

      let after = await vaultEngine.assets(ASSET_ID.FLR);
      expect(after[1]).to.equal(EXPECTED_SUPP_ACCUMULATOR);

      TIME_TO_INCREASE = 394000;

      await vaultEngine.setTotalUserDebt(0);
      mpr = await teller.mpr();
      await teller.updateAccumulators(ASSET_ID.FLR);
      vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
      lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators(ASSET_ID.FLR);

      lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
      totalDebt = await vaultEngine.lendingPoolDebt();
      lendingPoolEquity = await vaultEngine.lendingPoolEquity();
      utilitization = wdiv(totalDebt, lendingPoolEquity);
      multipledByUtilization = rmul(mpr.sub(RAY), utilitization.mul(1e9));
      exponentiated = rpow(
        multipledByUtilization.add(RAY),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );

      EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);

      after = await vaultEngine.assets(ASSET_ID.FLR);
      expect(after[1]).to.equal(EXPECTED_SUPP_ACCUMULATOR);
    });

    it("tests that protocolFeeRate is calculated properly", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);
      await teller.setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET);
      const DEFAULT_SUPP_ACCUMULATOR = RAY;
      let TIME_TO_INCREASE = 400000;
      await teller.updateAccumulators(ASSET_ID.FLR);

      let vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
      let lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
      let captialAccumulatorBefore = (await vaultEngine.assets(ASSET_ID.FLR))
        .equityAccumulator;
      let before = await vaultEngine.assets(ASSET_ID.FLR);
      expect(before[1]).to.equal(DEFAULT_SUPP_ACCUMULATOR);
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators(ASSET_ID.FLR);

      let lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
      let mpr = await teller.mpr();
      let totalDebt = await vaultEngine.lendingPoolDebt();
      let lendingPoolEquity = await vaultEngine.lendingPoolEquity();
      let utilitization = wdiv(totalDebt, lendingPoolEquity);
      let multipledByUtilization = rmul(mpr.sub(RAY), utilitization.mul(1e9));
      let exponentiated = rpow(
        multipledByUtilization.add(RAY),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );
      let EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);
      let EXPECTED_SUPP_ACCUMULATOR_RATE = EXPECTED_SUPP_ACCUMULATOR.sub(
        captialAccumulatorBefore
      );
      let EXPECTED_PROTOCOL_FEE_RATE =
        EXPECTED_SUPP_ACCUMULATOR_RATE.mul(PROTOCOL_FEE_TO_SET).div(WAD);
      EXPECTED_SUPP_ACCUMULATOR_RATE = EXPECTED_SUPP_ACCUMULATOR_RATE.sub(
        EXPECTED_PROTOCOL_FEE_RATE
      );

      let after = await vaultEngine.assets(ASSET_ID.FLR);
      expect(after[1]).to.equal(
        captialAccumulatorBefore.add(EXPECTED_SUPP_ACCUMULATOR_RATE)
      );
      let protocolRate = await vaultEngine.protocolFeeRates();
      expect(protocolRate).to.equal(EXPECTED_PROTOCOL_FEE_RATE);
    });
  });
});
