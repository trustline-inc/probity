import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { MockVaultEngine, Registry, Teller } from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import {
  bytes32,
  PRECISION_AUR,
  PRECISION_COLL,
  PRECISION_PRICE,
} from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
import { rmul, rpow, wdiv } from "../utils/math";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let teller: Teller;
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePoolAddress: string;

let flrCollId = bytes32("FLR");
let EQUITY_TO_SET = PRECISION_AUR.mul(2000);
let DEBT_TO_SET = PRECISION_AUR.mul(1000);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Teller Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;

    contracts = await probity.deployTeller({
      vaultEngine: contracts.mockVaultEngine.address,
    });
    vaultEngine = contracts.mockVaultEngine;
    reservePoolAddress = contracts.reservePool.address;
    teller = contracts.teller;

    owner = signers.owner;
    user = signers.alice;
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
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await teller
        .connect(user)
        .setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS);
    });
  });

  describe("setProtocolFee Unit Tests", function () {
    beforeEach(async function () {
      await teller.initCollType(flrCollId, 0);
    });

    it("tests that values are properly set", async () => {
      const PROTOCOL_FEE_TO_SET = PRECISION_COLL.div(10);
      const collBefore = await teller.collateralTypes(flrCollId);
      expect(collBefore.protocolFee).to.equal(0);
      await teller.setProtocolFee(flrCollId, PROTOCOL_FEE_TO_SET);
      const collAfter = await teller.collateralTypes(flrCollId);
      expect(collAfter.protocolFee).to.not.equal(0);
    });

    it("can only be called by gov address", async () => {
      const PROTOCOL_FEE_TO_SET = PRECISION_COLL.div(10);
      await assertRevert(
        teller
          .connect(user)
          .setProtocolFee(bytes32("new coll"), PROTOCOL_FEE_TO_SET),
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await teller.connect(user).setProtocolFee(flrCollId, PROTOCOL_FEE_TO_SET);
    });
  });

  describe("initCollType Unit Tests", function () {
    it("tests that values are properly initialized", async () => {
      const collBefore = await teller.collateralTypes(flrCollId);
      expect(collBefore[0]).to.equal(0);
      expect(collBefore[1]).to.equal(0);
      await teller.initCollType(flrCollId, 0);
      const collAfter = await teller.collateralTypes(flrCollId);
      expect(collAfter[0]).to.not.equal(0);
      expect(collAfter[1]).to.equal(0);
    });

    it("can only be called by gov address", async () => {
      await assertRevert(
        teller.connect(user).initCollType(bytes32("new coll"), 0),
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address);
      await teller.connect(user).initCollType(flrCollId, 0);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    beforeEach(async function () {
      await teller.initCollType(flrCollId, 0);
      await vaultEngine.initAssetType(flrCollId);
      await vaultEngine.setTotalDebt(DEBT_TO_SET);
      await vaultEngine.setTotalEquity(EQUITY_TO_SET);
    });

    it("fails if collType has not been initialized", async () => {
      const newCollId = bytes32("new coll");
      await assertRevert(
        teller.updateAccumulator(newCollId),
        "Teller/updateAccumulator: Collateral type not initialized"
      );
      await teller.initCollType(newCollId, 0);
      await teller.updateAccumulator(newCollId);
    });

    it("updates the lastUtilization", async () => {
      const EXPECTED_UTILIAZATION_RATIO = wdiv(DEBT_TO_SET, EQUITY_TO_SET);
      const before = await teller.collateralTypes(flrCollId);
      expect(before[0]).to.not.equal(0);
      expect(before[1]).to.equal(0);
      await increaseTime(40000);
      await teller.updateAccumulator(flrCollId);
      const after = await teller.collateralTypes(flrCollId);
      expect(after[0]).to.gt(before[0]);
      expect(after[1]).to.equal(EXPECTED_UTILIAZATION_RATIO);
    });

    it("fail if totalEquity is 0", async () => {
      await vaultEngine.setTotalEquity(0);
      await assertRevert(
        teller.updateAccumulator(flrCollId),
        "Teller/UpdateAccumulator: Total equity can not be zero"
      );
      await vaultEngine.setTotalEquity(EQUITY_TO_SET);

      await teller.updateAccumulator(flrCollId);
    });

    it("tests that APR is set properly", async () => {
      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(25));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      let apr = await teller.apr();
      expect(apr).to.equal("1015000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(50));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("1020000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(75));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("1040000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(90));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("1100000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(95));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("1200000000000000000000000000");
    });

    it("tests that APR won't go over MAX_APR", async () => {
      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(990));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      let apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(995));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(1000));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(1100));
      await vaultEngine.setTotalEquity(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");
    });

    it("tests that debtAccumulator is calculated properly", async () => {
      const DEFAULT_DEBT_ACCUMULATOR = PRECISION_PRICE;
      let TIME_TO_INCREASE = 400000;

      await teller.updateAccumulator(flrCollId);
      let vaultColl = await vaultEngine.assets(flrCollId);
      let mpr = await teller.mpr();

      let lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      const before = await vaultEngine.assets(flrCollId);
      expect(before[0]).to.equal(DEFAULT_DEBT_ACCUMULATOR);

      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);
      let lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];

      let EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore)),
        vaultColl[0]
      );

      let after = await vaultEngine.assets(flrCollId);
      expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);

      vaultColl = await vaultEngine.assets(flrCollId);
      mpr = await teller.mpr();
      TIME_TO_INCREASE = 23000;

      lastUpdatedBefore = lastUpdatedAfter;
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];

      EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore)),
        vaultColl[0]
      );

      after = await vaultEngine.assets(flrCollId);
      expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);
    });

    it("tests that suppAccumulator is calculated properly", async () => {
      const DEFAULT_SUPP_ACCUMULATOR = PRECISION_PRICE;
      let TIME_TO_INCREASE = 400000;

      await teller.updateAccumulator(flrCollId);

      let vaultColl = await vaultEngine.assets(flrCollId);
      let lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      let before = await vaultEngine.assets(flrCollId);
      expect(before[1]).to.equal(DEFAULT_SUPP_ACCUMULATOR);
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      let lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];
      let mpr = await teller.mpr();
      let utilitization = (await teller.collateralTypes(flrCollId))
        .lastUtilization;
      let multipledByUtilization = rmul(
        mpr.sub(PRECISION_PRICE),
        utilitization.mul(1e9)
      );
      let exponentiated = rpow(
        multipledByUtilization.add(PRECISION_PRICE),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );

      let EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);

      let after = await vaultEngine.assets(flrCollId);
      expect(after[1]).to.equal(EXPECTED_SUPP_ACCUMULATOR);

      TIME_TO_INCREASE = 394000;

      await vaultEngine.setTotalDebt(0);
      mpr = await teller.mpr();
      await teller.updateAccumulator(flrCollId);
      vaultColl = await vaultEngine.assets(flrCollId);
      lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];
      utilitization = (await teller.collateralTypes(flrCollId)).lastUtilization;
      multipledByUtilization = rmul(
        mpr.sub(PRECISION_PRICE),
        utilitization.mul(1e9)
      );
      exponentiated = rpow(
        multipledByUtilization.add(PRECISION_PRICE),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );

      EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);

      after = await vaultEngine.assets(flrCollId);
      expect(after[1]).to.equal(EXPECTED_SUPP_ACCUMULATOR);
    });

    it("tests that protocolFeeRate is calculated properly", async () => {
      const PROTOCOL_FEE_TO_SET = PRECISION_COLL.div(10);
      await teller.setProtocolFee(flrCollId, PROTOCOL_FEE_TO_SET);
      const DEFAULT_SUPP_ACCUMULATOR = PRECISION_PRICE;
      let TIME_TO_INCREASE = 400000;
      await teller.updateAccumulator(flrCollId);

      let vaultColl = await vaultEngine.assets(flrCollId);
      let lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      let captialAccumulatorBefore = (await vaultEngine.assets(flrCollId))
        .equityAccumulator;
      let before = await vaultEngine.assets(flrCollId);
      expect(before[1]).to.equal(DEFAULT_SUPP_ACCUMULATOR);
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      let lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];
      let mpr = await teller.mpr();
      let utilitization = (await teller.collateralTypes(flrCollId))
        .lastUtilization;
      let multipledByUtilization = rmul(
        mpr.sub(PRECISION_PRICE),
        utilitization.mul(1e9)
      );
      let exponentiated = rpow(
        multipledByUtilization.add(PRECISION_PRICE),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );
      let EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);
      let EXPECTED_SUPP_ACCUMULATOR_RATE = EXPECTED_SUPP_ACCUMULATOR.sub(
        captialAccumulatorBefore
      );
      let EXPECTED_PROTOCOL_FEE_RATE =
        EXPECTED_SUPP_ACCUMULATOR_RATE.mul(PROTOCOL_FEE_TO_SET).div(
          PRECISION_COLL
        );
      EXPECTED_SUPP_ACCUMULATOR_RATE = EXPECTED_SUPP_ACCUMULATOR_RATE.sub(
        EXPECTED_PROTOCOL_FEE_RATE
      );

      let after = await vaultEngine.assets(flrCollId);
      expect(after[1]).to.equal(
        captialAccumulatorBefore.add(EXPECTED_SUPP_ACCUMULATOR_RATE)
      );
      let protocolRate = await vaultEngine.protocolFeeRates();
      expect(protocolRate).to.equal(EXPECTED_PROTOCOL_FEE_RATE);
    });
  });
});
