import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { MockVaultEngine, Registry, Teller } from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import {
  bytes32,
  RAD,
  WAD,
  RAY,
  ASSET_ID,
  APR_TO_MPR,
} from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import increaseTime from "../utils/increaseTime";
import { rdiv, rmul, rpow, wdiv } from "../utils/math";
import parseEvents from "../utils/parseEvents";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;

// Contracts
let teller: Teller;
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePoolAddress: string;

let EQUITY_TO_SET = WAD.mul(2000);
let DEBT_TO_SET = WAD.mul(1000);

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
    user2 = signers.bob!;
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
    it("tests that values are properly set", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);
      let protocolFee = await teller.protocolFee();
      expect(protocolFee).to.equal(0);
      await teller.setProtocolFee(PROTOCOL_FEE_TO_SET);
      protocolFee = await teller.protocolFee();
      expect(protocolFee).to.not.equal(0);
    });

    it("can only be called by gov address", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);
      await assertRevert(
        teller.connect(user).setProtocolFee(PROTOCOL_FEE_TO_SET),
        "AccessControl/onlyBy: Caller does not have permission"
      );
      await registry.setupAddress(bytes32("gov"), user.address, true);
      await teller.connect(user).setProtocolFee(PROTOCOL_FEE_TO_SET);
    });

    it("tests that LogVarUpdate event is emitted properly", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);

      let parsedEvents = await parseEvents(
        teller.setProtocolFee(PROTOCOL_FEE_TO_SET),
        "LogVarUpdate",
        teller
      );

      expect(parsedEvents[0].args[0]).to.equal(bytes32("teller"));
      expect(parsedEvents[0].args[1]).to.equal(bytes32("protocolFee"));
      expect(parsedEvents[0].args[2]).to.equal(0);
      expect(parsedEvents[0].args[3]).to.equal(PROTOCOL_FEE_TO_SET);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    beforeEach(async function () {
      await vaultEngine.initAsset(ASSET_ID.FLR, 2);
      await vaultEngine.setLendingPoolDebt(DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(EQUITY_TO_SET);
    });

    it("fail if lendingPoolSupply is 0", async () => {
      await vaultEngine.setLendingPoolSupply(0);
      await assertRevert(
        teller.updateAccumulators(),
        "Teller/updateAccumulators: Lending pool supply cannot be zero"
      );
      await vaultEngine.setLendingPoolSupply(EQUITY_TO_SET);

      await teller.updateAccumulators();
    });

    it("tests that APR is set properly for 20% utilization", async () => {
      await vaultEngine.setLendingPoolPrincipal(WAD.mul(25));
      await vaultEngine.setLendingPoolSupply(WAD.mul(100));

      await teller.updateAccumulators();
      let apr = await teller.apr();
      expect(apr).to.equal("1015000000000000000000000000");
    });

    it("tests that APR is set properly for 50% utilization", async () => {
      await vaultEngine.setLendingPoolPrincipal(WAD.mul(50));
      await vaultEngine.setLendingPoolSupply(WAD.mul(100));

      await teller.updateAccumulators();
      let apr = await teller.apr();
      expect(apr).to.equal("1020000000000000000000000000");
    });

    it("tests that APR is set properly for 75% utilization", async () => {
      await vaultEngine.setLendingPoolPrincipal(WAD.mul(75));
      await vaultEngine.setLendingPoolSupply(WAD.mul(100));

      await teller.updateAccumulators();
      let apr = await teller.apr();
      expect(apr).to.equal("1040000000000000000000000000");
    });

    it("tests that APR is set properly for 90% utilization", async () => {
      await vaultEngine.setLendingPoolPrincipal(WAD.mul(90));
      await vaultEngine.setLendingPoolSupply(WAD.mul(100));

      await teller.updateAccumulators();
      let apr = await teller.apr();
      expect(apr).to.equal("1100000000000000000000000000");
    });

    it("tests that APR is set properly for 95% utilization", async () => {
      await vaultEngine.setLendingPoolPrincipal(WAD.mul(95));
      await vaultEngine.setLendingPoolSupply(WAD.mul(100));

      await teller.updateAccumulators();
      let apr = await teller.apr();
      expect(apr).to.equal("1200000000000000000000000000");
    });

    it("tests that APR won't go over MAX_APR", async () => {
      await vaultEngine.setLendingPoolPrincipal(WAD.mul(990));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));

      await teller.updateAccumulators();
      let apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setLendingPoolPrincipal(WAD.mul(995));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));

      await teller.updateAccumulators();
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setLendingPoolPrincipal(WAD.mul(1000));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));

      await teller.updateAccumulators();
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");

      await vaultEngine.setLendingPoolPrincipal(WAD.mul(1100));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));

      await teller.updateAccumulators();
      apr = await teller.apr();
      expect(apr).to.equal("2000000000000000000000000000");
    });

    it("tests that debtAccumulator is calculated properly", async () => {
      const DEFAULT_DEBT_ACCUMULATOR = RAY;
      let TIME_TO_INCREASE = 400000;

      await vaultEngine.setLendingPoolPrincipal(WAD.mul(620));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));

      await teller.updateAccumulators();
      let debtAccuBefore = await vaultEngine.debtAccumulator();
      let mpr = await teller.mpr();

      let lastUpdatedBefore = await teller.lastUpdated();
      expect(debtAccuBefore).to.equal(DEFAULT_DEBT_ACCUMULATOR);

      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators();
      let lastUpdatedAfter = await teller.lastUpdated();

      let EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore).toNumber()),
        debtAccuBefore
      );

      let debtAccuAfter = await vaultEngine.debtAccumulator();
      expect(debtAccuAfter).to.equal(EXPECTED_DEBT_ACCUMULATOR);

      debtAccuBefore = await vaultEngine.debtAccumulator();
      mpr = await teller.mpr();
      TIME_TO_INCREASE = 23000;

      lastUpdatedBefore = lastUpdatedAfter;
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators();

      lastUpdatedAfter = await teller.lastUpdated();

      EXPECTED_DEBT_ACCUMULATOR = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore).toNumber()),
        debtAccuBefore
      );

      debtAccuAfter = await vaultEngine.debtAccumulator();
      expect(debtAccuAfter).to.equal(EXPECTED_DEBT_ACCUMULATOR);
    });

    it("tests that equityAccumulator is calculated properly", async () => {
      const DEFAULT_SUPP_ACCUMULATOR = RAY;
      let TIME_TO_INCREASE = 400000;

      await vaultEngine.setLendingPoolPrincipal(WAD.mul(620));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));

      await teller.updateAccumulators();

      let equityAccu = await vaultEngine.equityAccumulator();
      let lastUpdatedBefore = await teller.lastUpdated();
      let equityAccuBefore = await vaultEngine.equityAccumulator();
      let debtAccuBefore = await vaultEngine.debtAccumulator();
      expect(equityAccuBefore).to.equal(DEFAULT_SUPP_ACCUMULATOR);

      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators();

      let lastUpdatedAfter = await teller.lastUpdated();
      let mpr = await teller.mpr();
      let lendingPoolDebt = await vaultEngine.lendingPoolDebt();
      let lendingPoolEquity = await vaultEngine.lendingPoolEquity();
      let EXPECTED_DEBT_RATE_INCREASE = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore).toNumber()),
        debtAccuBefore
      ).sub(debtAccuBefore);

      let EXPECTED_DEBT_CREATED =
        EXPECTED_DEBT_RATE_INCREASE.mul(lendingPoolDebt);
      let EXPECTED_SUPP_ACCUMULATOR = equityAccu.add(
        EXPECTED_DEBT_CREATED.div(lendingPoolEquity)
      );
      let equityAccuAfter = await vaultEngine.equityAccumulator();
      expect(equityAccuAfter).to.equal(EXPECTED_SUPP_ACCUMULATOR);
    });

    it("tests that protocolFeeRate is calculated properly", async () => {
      const PROTOCOL_FEE_TO_SET = WAD.div(10);
      await teller.setProtocolFee(PROTOCOL_FEE_TO_SET);
      const DEFAULT_SUPP_ACCUMULATOR = RAY;

      await vaultEngine.setLendingPoolPrincipal(WAD.mul(620));
      await vaultEngine.setLendingPoolSupply(WAD.mul(1000));
      let TIME_TO_INCREASE = 400000;
      await teller.updateAccumulators();

      let lastUpdatedBefore = await teller.lastUpdated();
      let captialAccumulatorBefore = await vaultEngine.equityAccumulator();
      let before = await vaultEngine.equityAccumulator();
      let debtAccuBefore = await vaultEngine.debtAccumulator();
      expect(before).to.equal(DEFAULT_SUPP_ACCUMULATOR);
      await increaseTime(TIME_TO_INCREASE);
      await teller.updateAccumulators();

      let lastUpdatedAfter = await teller.lastUpdated();
      let mpr = await teller.mpr();
      let lendingPoolDebt = await vaultEngine.lendingPoolDebt();
      let lendingPoolEquity = await vaultEngine.lendingPoolEquity();

      let EXPECTED_DEBT_RATE_INCREASE = rmul(
        rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore).toNumber()),
        debtAccuBefore
      ).sub(debtAccuBefore);

      let EXPECTED_DEBT_CREATED =
        EXPECTED_DEBT_RATE_INCREASE.mul(lendingPoolDebt);
      let EXPECTED_SUPP_ACCUMULATOR_RATE =
        EXPECTED_DEBT_CREATED.div(lendingPoolEquity);

      let EXPECTED_PROTOCOL_FEE_RATE =
        EXPECTED_SUPP_ACCUMULATOR_RATE.mul(PROTOCOL_FEE_TO_SET).div(WAD);
      EXPECTED_SUPP_ACCUMULATOR_RATE = EXPECTED_SUPP_ACCUMULATOR_RATE.sub(
        EXPECTED_PROTOCOL_FEE_RATE
      );

      let after = await vaultEngine.equityAccumulator();
      expect(after).to.equal(
        captialAccumulatorBefore.add(EXPECTED_SUPP_ACCUMULATOR_RATE)
      );
      let protocolRate = await vaultEngine.protocolFeeRates();
      expect(protocolRate).to.equal(EXPECTED_PROTOCOL_FEE_RATE);
    });
  });

  describe("issue-345", () => {
    beforeEach(async function () {
      let DEBT_TO_SET = WAD.mul(0);
      let EQUITY_TO_SET = WAD.mul(0);
      await vaultEngine.setLendingPoolDebt(DEBT_TO_SET);
      await vaultEngine.setLendingPoolEquity(EQUITY_TO_SET);

      // Initialize assets
      await vaultEngine.initAsset(ASSET_ID.USD, 0);
      await vaultEngine.initAsset(ASSET_ID.FLR, 1);
    });

    it("makes algorithmic loans correctly", async () => {
      // Test case for https://github.com/trustline-inc/probity/issues/345

      let lastUpdated = await teller.lastUpdated();
      let debtAccumulator = await vaultEngine.debtAccumulator();
      let equityAccumulator = await vaultEngine.equityAccumulator();

      // Issue 100 USD to user vault
      await vaultEngine.setStablecoin(user.address, RAD.mul(100));

      // Commit 100 USD to vault by using updateVault()
      let underlying = WAD.mul(100);
      let equity = RAD.mul(100);
      let initialEquity = WAD.mul(100);
      let normEquity = equity.div(equityAccumulator);
      let normDebt = ethers.BigNumber.from(0);
      let collateral = ethers.BigNumber.from(0);
      let principal = normDebt.mul(debtAccumulator).div(RAY);

      await vaultEngine.updateVault(
        ASSET_ID.USD,
        user.address,
        0,
        underlying,
        collateral,
        normDebt,
        normEquity,
        initialEquity
      );
      await vaultEngine.updateAsset(
        ASSET_ID.USD,
        RAY,
        normDebt,
        normEquity,
        RAD.mul(100),
        0
      );
      await vaultEngine.updateNormValues(ASSET_ID.USD, 0, normEquity);
      await vaultEngine.setLendingPoolEquity(normEquity);
      await vaultEngine.setLendingPoolSupply(underlying);

      // Get vault
      let vault = await vaultEngine.vaults(ASSET_ID.USD, user.address);
      expect(vault.normEquity).to.equal(normEquity);
      expect(vault.underlying).to.equal(underlying);

      // Get totals
      let lendingPoolEquity = await vaultEngine.lendingPoolEquity();
      let lendingPoolDebt = await vaultEngine.lendingPoolDebt();
      let lendingPoolSupply = await vaultEngine.lendingPoolSupply();
      let lendingPoolPrincipal = await vaultEngine.lendingPoolPrincipal();
      expect(lendingPoolEquity).to.equal(normEquity);
      expect(lendingPoolDebt).to.equal(normDebt);
      expect(lendingPoolSupply).to.equal(initialEquity);
      expect(lendingPoolPrincipal).to.equal(principal);

      // Update accumulators
      await teller.updateAccumulators();
      let timeDiff1 = (await teller.lastUpdated()).sub(lastUpdated);
      lastUpdated = await teller.lastUpdated();
      debtAccumulator = await vaultEngine.debtAccumulator();
      equityAccumulator = await vaultEngine.equityAccumulator();
      expect(debtAccumulator).to.equal(RAY);
      expect(equityAccumulator).to.equal(RAY);

      let mpr = RAY;
      let apr = await teller.apr();
      const expectedDebtAccumulator1 = rmul(
        rpow(mpr, timeDiff1.toNumber()),
        RAY
      );

      // Take out loan
      collateral = WAD.mul(175);
      principal = RAD.mul(50);
      normDebt = principal.div(debtAccumulator);

      await vaultEngine.updateVault(
        ASSET_ID.FLR,
        user2.address,
        0,
        0,
        collateral,
        normDebt,
        0,
        0
      );

      await vaultEngine.setLendingPoolDebt(normDebt);
      await vaultEngine.setLendingPoolPrincipal(principal.div(RAY));
      let ceiling = RAD.mul(100);
      vaultEngine.updateAsset(ASSET_ID.FLR, RAY, normDebt, 0, ceiling, 0);
      await vaultEngine.updateNormValues(ASSET_ID.FLR, normDebt, 0);

      expect(await vaultEngine.lendingPoolDebt()).to.equal(normDebt);
      expect(await vaultEngine.lendingPoolEquity()).to.equal(normEquity);

      // Update accumulators
      await teller.updateAccumulators();
      let timeDiff2 = (await teller.lastUpdated()).sub(lastUpdated);
      lastUpdated = await teller.lastUpdated();

      // Set expected debtAccumulator
      mpr = ethers.BigNumber.from(APR_TO_MPR[apr.toString()]);
      apr = await teller.apr();
      const expectedDebtAccumulator2 = rmul(
        rpow(ethers.BigNumber.from(mpr), timeDiff2.toNumber()),
        RAY
      );
      const expectedDebtAccumulator = rmul(
        expectedDebtAccumulator1,
        expectedDebtAccumulator2
      );

      debtAccumulator = await vaultEngine.debtAccumulator();
      equityAccumulator = await vaultEngine.equityAccumulator();

      // Expected debt
      vault = await vaultEngine.vaults(ASSET_ID.FLR, user2.address);
      expect(expectedDebtAccumulator).to.equal(debtAccumulator);
      const expectedDebt = principal.div(RAY).mul(expectedDebtAccumulator);
      expect(vault.normDebt).to.equal(normDebt);
      expect(debtAccumulator.mul(vault.normDebt)).to.equal(expectedDebt);

      // Expected equity
      vault = await vaultEngine.vaults(ASSET_ID.USD, user.address);
      const equityInterest = vault.normEquity
        .mul(equityAccumulator)
        .sub(initialEquity.mul(RAY));
      const loanInterest = normDebt.mul(debtAccumulator).sub(principal);
      expect(equityInterest).to.equal(loanInterest);
    });
  });
});
