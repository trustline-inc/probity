import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { MockVaultEngine, Registry, Teller } from "../../typechain";

import { deployProbity, probity, mock } from "../../lib/deployer";
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

let flrCollId = bytes32("FLR");
let SUPPLY_TO_SET = PRECISION_AUR.mul(2000);
let DEBT_TO_SET = PRECISION_AUR.mul(1000);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Teller Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployProbity();
    // Set contracts
    registry = contracts.registry;

    contracts = await mock.deployMockVaultEngine();
    contracts = await probity.deployTeller({
      vaultEngine: contracts.mockVaultEngine,
    });
    vaultEngine = contracts.mockVaultEngine;

    teller = contracts.teller;

    owner = signers.owner;
    user = signers.alice;
  });

  describe("initCollType Unit Tests", function () {
    it("tests that values are properly initialized", async () => {
      const collBefore = await teller.collateralTypes(flrCollId);
      expect(collBefore[0]).to.equal(0);
      expect(collBefore[1]).to.equal(0);
      await teller.initCollType(flrCollId);
      const collAfter = await teller.collateralTypes(flrCollId);
      expect(collAfter[0]).to.not.equal(0);
      expect(collAfter[1]).to.equal(0);
    });

    it("can only be called by gov address", async () => {
      await assertRevert(
        teller.connect(user).initCollType(bytes32("new coll")),
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await registry.setupContractAddress(bytes32("gov"), user.address);
      await teller.connect(user).initCollType(flrCollId);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    beforeEach(async function () {
      await teller.initCollType(flrCollId);
      await vaultEngine.initCollType(flrCollId);
      await vaultEngine.setTotalDebt(DEBT_TO_SET);
      await vaultEngine.setTotalCapital(SUPPLY_TO_SET);
    });

    it("fails if collType has not been initialized", async () => {
      const newCollId = bytes32("new coll");
      await assertRevert(
        teller.updateAccumulator(newCollId),
        "Teller/updateAccumulator: Collateral Type not initialized"
      );
      await teller.initCollType(newCollId);
      await teller.updateAccumulator(newCollId);
    });

    it("updates the lastUtilization", async () => {
      const EXPECTED_UTILIAZATION_RATIO = wdiv(DEBT_TO_SET, SUPPLY_TO_SET);
      const before = await teller.collateralTypes(flrCollId);
      expect(before[0]).to.not.equal(0);
      expect(before[1]).to.equal(0);
      await increaseTime(40000);
      await teller.updateAccumulator(flrCollId);
      const after = await teller.collateralTypes(flrCollId);
      expect(after[0]).to.gt(before[0]);
      expect(after[1]).to.equal(EXPECTED_UTILIAZATION_RATIO);
    });

    it("fail if totalSupply is 0", async () => {
      await vaultEngine.setTotalCapital(0);
      await assertRevert(
        teller.updateAccumulator(flrCollId),
        "Teller/UpdateAccumulator: total Capital can not be zero"
      );
      await vaultEngine.setTotalCapital(SUPPLY_TO_SET);

      await teller.updateAccumulator(flrCollId);
    });

    it("tests that APR is set properly", async () => {
      // test APR at 25%, 50%, 75%, 90% and 95%
      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(25));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      let APR = await teller.APR();
      expect(APR).to.equal("1015000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(50));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("1020000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(75));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("1040000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(90));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("1100000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(95));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(100));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("1200000000000000000000000000");
    });

    it("tests that APR won't go over MAX_APR", async () => {
      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(990));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      let APR = await teller.APR();
      expect(APR).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(995));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(1000));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("2000000000000000000000000000");

      await vaultEngine.setTotalDebt(PRECISION_AUR.mul(1100));
      await vaultEngine.setTotalCapital(PRECISION_AUR.mul(1000));

      await teller.updateAccumulator(flrCollId);
      APR = await teller.APR();
      expect(APR).to.equal("2000000000000000000000000000");
    });

    it("tests that debtAccumulator is calculated properly", async () => {
      const DEFAULT_DEBT_ACCUMULATOR = PRECISION_PRICE;
      let TIME_TO_INCREASE = 400000;

      await teller.updateAccumulator(flrCollId);
      let vaultColl = await vaultEngine.collateralTypes(flrCollId);
      let MPR = await teller.MPR();

      let lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      const before = await vaultEngine.collateralTypes(flrCollId);
      expect(before[0]).to.equal(DEFAULT_DEBT_ACCUMULATOR);

      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);
      let lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];

      let EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(MPR, lastUpdatedAfter.sub(lastUpdatedBefore)),
        vaultColl[0]
      );

      let after = await vaultEngine.collateralTypes(flrCollId);
      expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);

      vaultColl = await vaultEngine.collateralTypes(flrCollId);
      MPR = await teller.MPR();
      TIME_TO_INCREASE = 23000;

      lastUpdatedBefore = lastUpdatedAfter;
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];

      EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(MPR, lastUpdatedAfter.sub(lastUpdatedBefore)),
        vaultColl[0]
      );

      after = await vaultEngine.collateralTypes(flrCollId);
      expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);
    });

    it("tests that suppAccumulator is calculated properly", async () => {
      const DEFAULT_SUPP_ACCUMULATOR = PRECISION_PRICE;
      let TIME_TO_INCREASE = 400000;

      await teller.updateAccumulator(flrCollId);

      let vaultColl = await vaultEngine.collateralTypes(flrCollId);
      let lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      let before = await vaultEngine.collateralTypes(flrCollId);
      expect(before[1]).to.equal(DEFAULT_SUPP_ACCUMULATOR);
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      let lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];
      let MPR = await teller.MPR();
      let utilitization = (await teller.collateralTypes(flrCollId))
        .lastUtilization;
      let multipledByUtilization = rmul(
        MPR.sub(PRECISION_PRICE),
        utilitization.mul(1e9)
      );
      let exponentiated = rpow(
        multipledByUtilization.add(PRECISION_PRICE),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );

      let EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);

      let after = await vaultEngine.collateralTypes(flrCollId);
      expect(after[1]).to.equal(EXPECTED_SUPP_ACCUMULATOR);

      TIME_TO_INCREASE = 394000;

      // to know if utilization is zero, how will it act?
      await vaultEngine.setTotalDebt(0);
      MPR = await teller.MPR();
      await teller.updateAccumulator(flrCollId);
      vaultColl = await vaultEngine.collateralTypes(flrCollId);
      lastUpdatedBefore = (await teller.collateralTypes(flrCollId))[0];
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulator(flrCollId);

      lastUpdatedAfter = (await teller.collateralTypes(flrCollId))[0];
      utilitization = (await teller.collateralTypes(flrCollId)).lastUtilization;
      multipledByUtilization = rmul(
        MPR.sub(PRECISION_PRICE),
        utilitization.mul(1e9)
      );
      exponentiated = rpow(
        multipledByUtilization.add(PRECISION_PRICE),
        lastUpdatedAfter.sub(lastUpdatedBefore)
      );

      EXPECTED_SUPP_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);

      after = await vaultEngine.collateralTypes(flrCollId);
      expect(after[1]).to.equal(EXPECTED_SUPP_ACCUMULATOR);
    });
  });
});
