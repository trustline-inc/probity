import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { network } from "hardhat";
import "@nomiclabs/hardhat-ethers";

import {
  ERC20AssetManager,
  MockVaultEngine,
  Registry,
  Teller,
  Treasury,
  USD,
} from "../../typechain";

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
import { BigNumber } from "ethers";
import { executionAsyncId } from "async_hooks";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;

// Contracts
let assetManager: ERC20AssetManager;
let teller: Teller;
let treasury: Treasury;
let usd: USD;
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
    contracts = await probity.deployTreasury({
      vaultEngine: contracts.mockVaultEngine?.address,
    });
    contracts = await probity.deployErc20AssetManager({
      erc20: contracts.usd?.address,
      symbol: "USD",
      vaultEngine: contracts.mockVaultEngine?.address,
    });
    usd = contracts.usd!;
    assetManager = contracts?.usdManager!;
    treasury = contracts.treasury!;
    vaultEngine = contracts.mockVaultEngine!;
    reservePoolAddress = contracts.reservePool?.address!;
    teller = contracts.teller!;

    owner = signers.owner!;
    user = signers.alice!;
    user2 = signers.bob!;

    await registry.setupAddress(bytes32("whitelisted"), user.address, false);
  });

  // describe("setReservePool Unit Tests", function () {
  //   it("tests that values are properly set", async () => {
  //     const NEW_RESERVE_POOL_ADDRESS = owner.address;
  //     const reservePoolBefore = await teller.reservePool();
  //     expect(reservePoolBefore).to.equal(reservePoolAddress);
  //     await teller.setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS);
  //     const reservePoolAfter = await teller.reservePool();
  //     expect(reservePoolAfter).to.equal(NEW_RESERVE_POOL_ADDRESS);
  //   });

  //   it("can only be called by gov address", async () => {
  //     const NEW_RESERVE_POOL_ADDRESS = owner.address;
  //     await assertRevert(
  //       teller.connect(user).setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS),
  //       "AccessControl/onlyBy: Caller does not have permission"
  //     );
  //     await registry.setupAddress(bytes32("gov"), user.address, true);
  //     await teller
  //       .connect(user)
  //       .setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS);
  //   });

  //   it("tests that LogVarUpdate event is emitted properly", async () => {
  //     const NEW_RESERVE_POOL_ADDRESS = owner.address;

  //     let parsedEvents = await parseEvents(
  //       teller.setReservePoolAddress(NEW_RESERVE_POOL_ADDRESS),
  //       "LogVarUpdate",
  //       teller
  //     );

  //     expect(parsedEvents[0].args[0]).to.equal(bytes32("teller"));
  //     expect(parsedEvents[0].args[1]).to.equal(bytes32("reservePool"));
  //     expect(parsedEvents[0].args[2]).to.equal(reservePoolAddress);
  //     expect(parsedEvents[0].args[3]).to.equal(NEW_RESERVE_POOL_ADDRESS);
  //   });
  // });

  // describe("setProtocolFee Unit Tests", function () {
  //   beforeEach(async function () {
  //     await teller.initAsset(ASSET_ID.FLR, 0);
  //   });

  //   it("tests that values are properly set", async () => {
  //     const PROTOCOL_FEE_TO_SET = WAD.div(10);
  //     const collBefore = await teller.assets(ASSET_ID.FLR);
  //     expect(collBefore.protocolFee).to.equal(0);
  //     await teller.setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET);
  //     const collAfter = await teller.assets(ASSET_ID.FLR);
  //     expect(collAfter.protocolFee).to.not.equal(0);
  //   });

  //   it("can only be called by gov address", async () => {
  //     const PROTOCOL_FEE_TO_SET = WAD.div(10);
  //     await assertRevert(
  //       teller
  //         .connect(user)
  //         .setProtocolFee(bytes32("new coll"), PROTOCOL_FEE_TO_SET),
  //       "AccessControl/onlyBy: Caller does not have permission"
  //     );
  //     await registry.setupAddress(bytes32("gov"), user.address, true);
  //     await teller
  //       .connect(user)
  //       .setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET);
  //   });

  //   it("tests that LogVarUpdate event is emitted properly", async () => {
  //     const PROTOCOL_FEE_TO_SET = WAD.div(10);

  //     let parsedEvents = await parseEvents(
  //       teller.setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET),
  //       "LogVarUpdate",
  //       teller
  //     );

  //     expect(parsedEvents[0].args[0]).to.equal(bytes32("teller"));
  //     expect(parsedEvents[0].args[1]).to.equal(ASSET_ID.FLR);
  //     expect(parsedEvents[0].args[2]).to.equal(bytes32("protocolFee"));
  //     expect(parsedEvents[0].args[3]).to.equal(0);
  //     expect(parsedEvents[0].args[4]).to.equal(PROTOCOL_FEE_TO_SET);
  //   });
  // });

  // describe("initAsset Unit Tests", function () {
  //   it("tests that values are properly initialized", async () => {
  //     const collBefore = await teller.assets(ASSET_ID.FLR);
  //     expect(collBefore[0]).to.equal(0);
  //     expect(collBefore[1]).to.equal(0);
  //     await teller.initAsset(ASSET_ID.FLR, 0);
  //     const collAfter = await teller.assets(ASSET_ID.FLR);
  //     expect(collAfter[0]).to.not.equal(0);
  //     expect(collAfter[1]).to.equal(0);
  //   });

  //   it("can only be called by gov address", async () => {
  //     await assertRevert(
  //       teller.connect(user).initAsset(bytes32("new coll"), 0),
  //       "AccessControl/onlyBy: Caller does not have permission"
  //     );
  //     await registry.setupAddress(bytes32("gov"), user.address, true);
  //     await teller.connect(user).initAsset(ASSET_ID.FLR, 0);
  //   });

  //   it("fails if asset has already been initialized", async () => {
  //     const assetId = bytes32("new asset");
  //     await teller.initAsset(assetId, 0);
  //     await assertRevert(
  //       teller.initAsset(assetId, 0),
  //       "Teller/initAsset: This asset has already been initialized"
  //     );
  //   });

  //   it("tests that AssetInitialized event is emitted properly", async () => {
  //     const PROTOCOL_FEE = WAD.div(10);

  //     let parsedEvents = await parseEvents(
  //       teller.initAsset(ASSET_ID.FLR, PROTOCOL_FEE),
  //       "AssetInitialized",
  //       teller
  //     );

  //     expect(parsedEvents[0].args[0]).to.equal(ASSET_ID.FLR);
  //     expect(parsedEvents[0].args[1]).to.equal(PROTOCOL_FEE);
  //   });
  // });

  describe("updateAccumulator Unit Tests", function () {
    // beforeEach(async function () {
    //   await teller.initAsset(ASSET_ID.FLR, 0);
    //   await vaultEngine.initAsset(ASSET_ID.FLR, 2);
    //   await vaultEngine.setLendingPoolDebt(DEBT_TO_SET);
    //   await vaultEngine.setLendingPoolEquity(EQUITY_TO_SET);
    // });
    // it("fails if collType has not been initialized", async () => {
    //   const newCollId = bytes32("new coll");
    //   await assertRevert(
    //     teller.updateAccumulators(newCollId),
    //     "Teller/updateAccumulators: Asset not initialized"
    //   );
    //   await teller.initAsset(newCollId, 0);
    //   await teller.updateAccumulators(newCollId);
    // });
    // it("fail if lendingPoolEquity is 0", async () => {
    //   await vaultEngine.setLendingPoolEquity(0);
    //   await assertRevert(
    //     teller.updateAccumulators(ASSET_ID.FLR),
    //     "Teller/updateAccumulators: Total equity cannot be zero"
    //   );
    //   await vaultEngine.setLendingPoolEquity(EQUITY_TO_SET);
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    // });
    // it("tests that APR is set properly", async () => {
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(25));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(100));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let apr = await teller.apr();
    //   expect(apr).to.equal("1015000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(50));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(100));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("1020000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(75));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(100));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("1040000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(90));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(100));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("1100000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(95));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(100));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("1200000000000000000000000000");
    // });
    // it("tests that APR won't go over MAX_APR", async () => {
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(990));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(1000));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let apr = await teller.apr();
    //   expect(apr).to.equal("2000000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(995));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(1000));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("2000000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(1000));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(1000));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("2000000000000000000000000000");
    //   await vaultEngine.setLendingPoolDebt(RAD.mul(1100));
    //   await vaultEngine.setLendingPoolEquity(RAD.mul(1000));
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   apr = await teller.apr();
    //   expect(apr).to.equal("2000000000000000000000000000");
    // });
    // it("tests that debtAccumulator is calculated properly", async () => {
    //   const DEFAULT_DEBT_ACCUMULATOR = RAY;
    //   let TIME_TO_INCREASE = 400000;
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
    //   let mpr = await teller.mpr();
    //   let lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
    //   const before = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(before[0]).to.equal(DEFAULT_DEBT_ACCUMULATOR);
    //   await increaseTime(TIME_TO_INCREASE);
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
    //   let EXPECTED_DEBT_ACCUMULATOR = rmul(
    //     rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore)),
    //     vaultColl[0]
    //   );
    //   let after = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);
    //   vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
    //   mpr = await teller.mpr();
    //   TIME_TO_INCREASE = 23000;
    //   lastUpdatedBefore = lastUpdatedAfter;
    //   await increaseTime(TIME_TO_INCREASE);
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
    //   EXPECTED_DEBT_ACCUMULATOR = rmul(
    //     rpow(mpr, lastUpdatedAfter.sub(lastUpdatedBefore)),
    //     vaultColl[0]
    //   );
    //   after = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(after[0]).to.equal(EXPECTED_DEBT_ACCUMULATOR);
    // });
    // it("tests that equityAccumulator is calculated properly", async () => {
    //   const DEFAULT_EQUITY_ACCUMULATOR = RAY;
    //   let TIME_TO_INCREASE = 400000;
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
    //   let lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
    //   let before = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(before[1]).to.equal(DEFAULT_EQUITY_ACCUMULATOR);
    //   await increaseTime(TIME_TO_INCREASE);
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
    //   let mpr = await teller.mpr();
    //   let totalDebt = await vaultEngine.lendingPoolDebt();
    //   let lendingPoolEquity = await vaultEngine.lendingPoolEquity();
    //   let utilitization = wdiv(totalDebt, lendingPoolEquity);
    //   let multipledByUtilization = rmul(mpr.sub(RAY), utilitization.mul(1e9));
    //   let exponentiated = rpow(
    //     multipledByUtilization.add(RAY),
    //     lastUpdatedAfter.sub(lastUpdatedBefore)
    //   );
    //   let EXPECTED_EQUITY_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);
    //   let after = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(after[1]).to.equal(EXPECTED_EQUITY_ACCUMULATOR);
    //   TIME_TO_INCREASE = 394000;
    //   await vaultEngine.setLendingPoolDebt(0);
    //   mpr = await teller.mpr();
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
    //   lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
    //   await increaseTime(TIME_TO_INCREASE);
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
    //   totalDebt = await vaultEngine.lendingPoolDebt();
    //   lendingPoolEquity = await vaultEngine.lendingPoolEquity();
    //   utilitization = wdiv(totalDebt, lendingPoolEquity);
    //   multipledByUtilization = rmul(mpr.sub(RAY), utilitization.mul(1e9));
    //   exponentiated = rpow(
    //     multipledByUtilization.add(RAY),
    //     lastUpdatedAfter.sub(lastUpdatedBefore)
    //   );
    //   EXPECTED_EQUITY_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);
    //   after = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(after[1]).to.equal(EXPECTED_EQUITY_ACCUMULATOR);
    // });
    // it("tests that protocolFeeRate is calculated properly", async () => {
    //   const PROTOCOL_FEE_TO_SET = WAD.div(10);
    //   await teller.setProtocolFee(ASSET_ID.FLR, PROTOCOL_FEE_TO_SET);
    //   const DEFAULT_EQUITY_ACCUMULATOR = RAY;
    //   let TIME_TO_INCREASE = 400000;
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let vaultColl = await vaultEngine.assets(ASSET_ID.FLR);
    //   let lastUpdatedBefore = (await teller.assets(ASSET_ID.FLR))[0];
    //   let equityAccumulatorBefore = await vaultEngine.equityAccumulator();
    //   let before = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(before[1]).to.equal(DEFAULT_EQUITY_ACCUMULATOR);
    //   await increaseTime(TIME_TO_INCREASE);
    //   await teller.updateAccumulators(ASSET_ID.FLR);
    //   let lastUpdatedAfter = (await teller.assets(ASSET_ID.FLR))[0];
    //   let mpr = await teller.mpr();
    //   let totalDebt = await vaultEngine.lendingPoolDebt();
    //   let lendingPoolEquity = await vaultEngine.lendingPoolEquity();
    //   let utilitization = wdiv(totalDebt, lendingPoolEquity);
    //   let multipledByUtilization = rmul(mpr.sub(RAY), utilitization.mul(1e9));
    //   let exponentiated = rpow(
    //     multipledByUtilization.add(RAY),
    //     lastUpdatedAfter.sub(lastUpdatedBefore)
    //   );
    //   let EXPECTED_EQUITY_ACCUMULATOR = rmul(exponentiated, vaultColl[1]);
    //   let EXPECTED_EQUITY_ACCUMULATOR_RATE = EXPECTED_EQUITY_ACCUMULATOR.sub(
    //     equityAccumulatorBefore
    //   );
    //   let EXPECTED_PROTOCOL_FEE_RATE =
    //     EXPECTED_EQUITY_ACCUMULATOR_RATE.mul(PROTOCOL_FEE_TO_SET).div(WAD);
    //   EXPECTED_EQUITY_ACCUMULATOR_RATE = EXPECTED_EQUITY_ACCUMULATOR_RATE.sub(
    //     EXPECTED_PROTOCOL_FEE_RATE
    //   );
    //   let after = await vaultEngine.assets(ASSET_ID.FLR);
    //   expect(after[1]).to.equal(
    //     equityAccumulatorBefore.add(EXPECTED_EQUITY_ACCUMULATOR_RATE)
    //   );
    //   let protocolRate = await vaultEngine.protocolFeeRates();
    //   expect(protocolRate).to.equal(EXPECTED_PROTOCOL_FEE_RATE);
    // });
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
      let normDebt = BigNumber.from(0);
      let collateral = BigNumber.from(0);
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
      const expectedDebtAccumulator1 = rmul(rpow(mpr, timeDiff1), RAY);

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
      mpr = APR_TO_MPR[apr.toString()];
      apr = await teller.apr();
      const expectedDebtAccumulator2 = rmul(
        rpow(BigNumber.from(mpr), timeDiff2),
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
