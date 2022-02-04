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
  VaultEngineSB,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY } from "../../utils/constants";
import { BigNumber } from "ethers";
import assertRevert from "../../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let coll: SignerWithAddress;

// Contracts
let vaultEngine: VaultEngineSB;
let registry: Registry;
let reservePool: ReservePool;
let nativeToken: NativeToken;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

let flrAssetId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Songbird Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.vaultEngineSB;
    reservePool = contracts.reservePool;
    nativeToken = contracts.nativeToken;
    teller = contracts.teller;
    priceFeed = contracts.priceFeed;
    ftso = contracts.ftso;
    treasury = contracts.treasury;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    coll = signers.don;

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
        .setupAddress(bytes32("assetManager"), coll.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));
      await vaultEngine
        .connect(coll)
        .modifyStandbyAsset(flrAssetId, owner.address, UNDERLYING_AMOUNT);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(RAD.mul(1000000));
    });

    it("tests new user is added to userList", async () => {
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

    it("tests existing user is NOT added to userList", async () => {
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
        .setupAddress(bytes32("assetManager"), coll.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(RAD.mul(1000000));

      await vaultEngine
        .connect(coll)
        .modifyStandbyAsset(flrAssetId, owner.address, COLL_AMOUNT);

      await vaultEngine
        .connect(coll)
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

  describe("individualVaultLimit Unit Tests", function () {
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
        .setupAddress(bytes32("assetManager"), coll.address);
    });

    it("updateIndividualVaultLimit works properly", async () => {
      const NEW_INDIVIDUAL_VAULT_LIMTI = RAD.mul(500);
      expect(await vaultEngine.connect(gov).individualVaultLimit()).to.equal(0);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);
      expect(await vaultEngine.connect(gov).individualVaultLimit()).to.equal(
        NEW_INDIVIDUAL_VAULT_LIMTI
      );
    });

    it("modifyDebt uses individualVaultLimit", async () => {
      const UNDERLYING_AMOUNT = WAD.mul(10000);
      const COLL_AMOUNT = WAD.mul(10000);
      const EQUITY_AMOUNT = WAD.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMTI = RAD.mul(500);

      await vaultEngine
        .connect(coll)
        .modifyStandbyAsset(
          flrAssetId,
          owner.address,
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await assertRevert(
        vaultEngine.modifyEquity(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("modifyEquity uses individualVaultLimit", async () => {
      const UNDERLYING_AMOUNT = WAD.mul(10000);
      const COLL_AMOUNT = WAD.mul(10000);
      const DEBT_AMOUNT = WAD.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMIT = RAD.mul(1000);

      await vaultEngine
        .connect(coll)
        .modifyStandbyAsset(
          flrAssetId,
          owner.address,
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await vaultEngine.connect(gov).updateIndividualVaultLimit(RAD.mul(500));

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        DEBT_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          DEBT_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMIT);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        DEBT_AMOUNT
      );
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    const UNDERLYING_AMOUNT = WAD.mul(10000);
    const COLL_AMOUNT = WAD.mul(10000);
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
        .setupAddress(bytes32("assetManager"), coll.address);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(RAD.mul(1000000));
      await vaultEngine
        .connect(coll)
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
        "AccessControl/onlyBy: Caller does not have permission"
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
      const collBefore = await vaultEngine.assets(flrAssetId);
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

      const collAfter = await vaultEngine.assets(flrAssetId);
      expect(collBefore.debtAccumulator.add(debtToRaise)).to.equal(
        collAfter.debtAccumulator
      );
      expect(collBefore.equityAccumulator.add(capToRaise)).to.equal(
        collAfter.equityAccumulator
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
        "VaultEngine/updateAccumulators: The equity rate increase is larger than the debt rate increase"
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

      const EXPECTED_AUR = protocolFee.mul(EQUITY_AMOUNT);

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
