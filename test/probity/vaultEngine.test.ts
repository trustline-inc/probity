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
    const EQUITY_AMOUNT = RAD.mul(2000);

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

    it("fails if asset amount falls below the minimum (floor)", async () => {
      const FLOOR_AMOUNT = RAD.mul(1000);
      const EQUITY_AMOUNT_UNDER_FLOOR = FLOOR_AMOUNT.sub(1);
      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address);

      await vaultEngine.connect(gov).updateFloor(flrAssetId, RAD.mul(1000));

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

    it("adds new users to the user list", async () => {
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
  });

  describe("modifyDebt Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const COLL_AMOUNT = WAD.mul(10000);
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
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, owner.address, COLL_AMOUNT);

      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(flrAssetId, user.address, COLL_AMOUNT);

      await vaultEngine
        .connect(user)
        .modifyEquity(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        );
    });

    it("only whitelisted user can call modifyDebt", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address);
      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          COLL_AMOUNT,
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
        COLL_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("fails if vault value is below the minimum(floor)", async () => {
      const FLOOR_AMOUNT = RAD.mul(800);
      const DEBT_AMOUNT_UNDER_FLOOR = FLOOR_AMOUNT.sub(1);

      await registry
        .connect(gov)
        .setupAddress(bytes32("whitelisted"), owner.address);

      await vaultEngine.connect(gov).updateFloor(flrAssetId, FLOOR_AMOUNT);

      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          COLL_AMOUNT,
          DEBT_AMOUNT_UNDER_FLOOR
        ),
        "Vault/modifyDebt: Debt smaller than floor"
      );

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        COLL_AMOUNT,
        DEBT_AMOUNT
      );
    });

    it("tests new user is added to userList", async () => {
      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        COLL_AMOUNT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(2);
      expect(after[1]).to.equal(owner.address);
    });

    it("tests existing user is NOT added to userList", async () => {
      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        COLL_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(2);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        COLL_AMOUNT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(2);
      expect(after[1]).to.equal(owner.address);
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const COLL_AMOUNT = WAD.mul(10000);
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
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
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
        COLL_AMOUNT,
        DEBT_AMOUNT
      );

      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);
    });

    it("tests that only teller can call updateAccumulators", async () => {
      const debtToRaise = BigNumber.from("251035088626883475473007");
      const capToRaise = BigNumber.from("125509667994754929166541");

      await assertRevert(
        vaultEngine.updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        ),
        "AccessControl/OnlyBy: Caller does not have permission"
      );
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        );
    });

    it("tests the debt and equity accumulators are properly updated", async () => {
      const assetBefore = await vaultEngine.assets(flrAssetId);
      const debtToRaise = BigNumber.from("251035088626883475473007");
      const capToRaise = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        );

      const assetAfter = await vaultEngine.assets(flrAssetId);
      expect(assetBefore.debtAccumulator.add(debtToRaise)).to.equal(
        assetAfter.debtAccumulator
      );
      expect(assetBefore.equityAccumulator.add(capToRaise)).to.equal(
        assetAfter.equityAccumulator
      );
    });

    it("tests that totalDebt and totalEquity are added properly", async () => {
      const totalDebtBefore = await vaultEngine.totalDebt();
      const totalEquityBefore = await vaultEngine.totalEquity();

      const debtToRaise = BigNumber.from("251035088626883475473007");
      const capToRaise = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        );

      const totalDebtAfter = await vaultEngine.totalDebt();
      const totalEquityAfter = await vaultEngine.totalEquity();

      expect(totalDebtAfter.sub(totalDebtBefore).gte(0)).to.equal(true);
      expect(totalEquityAfter.sub(totalEquityBefore).gte(0)).to.equal(true);
    });

    it("fails if new equity + protocolFee is higher than new debt", async () => {
      const debtToRaise = BigNumber.from("251035088626883475473007");
      let capToRaise = debtToRaise.add(1);
      await assertRevert(
        vaultEngine
          .connect(user)
          .updateAccumulators(
            flrAssetId,
            reservePool.address,
            debtToRaise,
            capToRaise,
            BigNumber.from(0)
          ),
        "VaultEngine/UpdateAccumulator: New equity created is larger than new debt"
      );

      capToRaise = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        );
    });

    it("tests the correct amount AUR is added to the reservePool", async () => {
      const debtToRaise = BigNumber.from("251035088626883475473007");
      const protocolFee = BigNumber.from("21035088626883475473007");
      const capToRaise = debtToRaise.div(2).sub(protocolFee);

      const EXPECTED_AUR = protocolFee.mul(EQUITY_AMOUNT.div(RAY));

      const reserveAurBefore = await vaultEngine.stablecoin(
        reservePool.address
      );
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrAssetId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          protocolFee
        );

      const reserveAurAfter = await vaultEngine.stablecoin(reservePool.address);
      expect(reserveAurAfter.sub(reserveAurBefore)).to.equal(EXPECTED_AUR);
    });
  });
});
