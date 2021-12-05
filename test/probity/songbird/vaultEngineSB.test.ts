import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  MockFtso,
  NativeCollateral,
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
import {
  bytes32,
  PRECISION_AUR,
  PRECISION_COLL,
  PRECISION_PRICE,
} from "../../utils/constants";
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
let nativeColl: NativeCollateral;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

let flrCollId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Songbird Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.vaultEngineSB;
    reservePool = contracts.reservePool;
    nativeColl = contracts.nativeCollateral;
    teller = contracts.teller;
    priceFeed = contracts.priceFeed;
    ftso = contracts.ftso;
    treasury = contracts.treasury;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    coll = signers.don;

    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry.setupAddress(bytes32("whiteListed"), user.address);
    await registry.setupAddress(bytes32("whiteListed"), owner.address);
  });

  describe("modifySupply Unit Tests", function () {
    const COLL_AMOUNT_SUPPLY = PRECISION_COLL.mul(10000);
    const CAPITAL_AMOUNT = PRECISION_COLL.mul(2000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initCollType(flrCollId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("collateral"), coll.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrCollId, PRECISION_PRICE.mul(1));
      await vaultEngine
        .connect(coll)
        .modifyCollateral(flrCollId, owner.address, COLL_AMOUNT_SUPPLY);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(PRECISION_AUR.mul(1000000));
    });

    it("tests new user is added to userList", async () => {
      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(0);

      await vaultEngine.modifySupply(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY,
        CAPITAL_AMOUNT
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(owner.address);
    });

    it("tests existing user is NOT added to userList", async () => {
      await vaultEngine.modifySupply(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY.div(2),
        CAPITAL_AMOUNT.div(2)
      );

      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifySupply(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY.div(2),
        CAPITAL_AMOUNT.div(2)
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(1);
      expect(after[0]).to.equal(owner.address);
    });
  });

  describe("modifyDebt Unit Tests", function () {
    const COLL_AMOUNT_SUPPLY = PRECISION_COLL.mul(10000);
    const COLL_AMOUNT_DEBT = PRECISION_COLL.mul(10000);
    const CAPITAL_AMOUNT = PRECISION_COLL.mul(2000);
    const DEBT_AMOUNT = PRECISION_COLL.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initCollType(flrCollId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("collateral"), coll.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrCollId, PRECISION_PRICE.mul(1));
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(PRECISION_AUR.mul(1000000));

      await vaultEngine
        .connect(coll)
        .modifyCollateral(flrCollId, owner.address, COLL_AMOUNT_DEBT);

      await vaultEngine
        .connect(coll)
        .modifyCollateral(flrCollId, user.address, COLL_AMOUNT_DEBT);

      await vaultEngine
        .connect(user)
        .modifySupply(
          flrCollId,
          treasury.address,
          COLL_AMOUNT_SUPPLY,
          CAPITAL_AMOUNT
        );
    });

    it("tests new user is added to userList", async () => {
      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(1);

      await vaultEngine.modifyDebt(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_DEBT,
        DEBT_AMOUNT
      );

      const after = await vaultEngine.getUserList();
      expect(after.length).to.equal(2);
      expect(after[1]).to.equal(owner.address);
    });

    it("tests existing user is NOT added to userList", async () => {
      await vaultEngine.modifyDebt(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_DEBT.div(2),
        DEBT_AMOUNT.div(2)
      );

      const before = await vaultEngine.getUserList();
      expect(before.length).to.equal(2);

      await vaultEngine.modifyDebt(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_DEBT.div(2),
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
      await vaultEngine.connect(gov).initCollType(flrCollId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("collateral"), coll.address);
    });

    it("updateIndividualVaultLimit works properly", async () => {
      const NEW_INDIVIDUAL_VAULT_LIMTI = PRECISION_AUR.mul(500);
      expect(await vaultEngine.connect(gov).individualVaultLimit()).to.equal(0);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);
      expect(await vaultEngine.connect(gov).individualVaultLimit()).to.equal(
        NEW_INDIVIDUAL_VAULT_LIMTI
      );
    });

    it("modifyDebt uses individualVaultLimit", async () => {
      const COLL_AMOUNT_SUPPLY = PRECISION_COLL.mul(10000);
      const COLL_AMOUNT_DEBT = PRECISION_COLL.mul(10000);
      const CAPITAL_AMOUNT = PRECISION_COLL.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMTI = PRECISION_AUR.mul(500);

      await vaultEngine
        .connect(coll)
        .modifyCollateral(
          flrCollId,
          owner.address,
          COLL_AMOUNT_DEBT.add(COLL_AMOUNT_SUPPLY)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrCollId, PRECISION_PRICE.mul(1));

      await assertRevert(
        vaultEngine.modifySupply(
          flrCollId,
          treasury.address,
          COLL_AMOUNT_SUPPLY,
          CAPITAL_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);

      await vaultEngine.modifySupply(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY,
        CAPITAL_AMOUNT
      );
    });

    it("modifyDebt uses individualVaultLimit", async () => {
      const COLL_AMOUNT_SUPPLY = PRECISION_COLL.mul(10000);
      const COLL_AMOUNT_DEBT = PRECISION_COLL.mul(10000);
      const DEBT_AMOUNT = PRECISION_COLL.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMTI = PRECISION_AUR.mul(1000);

      await vaultEngine
        .connect(coll)
        .modifyCollateral(
          flrCollId,
          owner.address,
          COLL_AMOUNT_DEBT.add(COLL_AMOUNT_SUPPLY)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrCollId, PRECISION_PRICE.mul(1));

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(PRECISION_AUR.mul(500));

      await vaultEngine.modifySupply(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY,
        DEBT_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyDebt(
          flrCollId,
          treasury.address,
          COLL_AMOUNT_SUPPLY,
          DEBT_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);

      await vaultEngine.modifyDebt(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY,
        DEBT_AMOUNT
      );
    });
  });

  describe("updateAccumulator Unit Tests", function () {
    const COLL_AMOUNT_SUPPLY = PRECISION_COLL.mul(10000);
    const COLL_AMOUNT_DEBT = PRECISION_COLL.mul(10000);
    const CAPITAL_AMOUNT = PRECISION_COLL.mul(2000);
    const DEBT_AMOUNT = PRECISION_COLL.mul(1000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initCollType(flrCollId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("collateral"), coll.address);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(PRECISION_AUR.mul(1000000));
      await vaultEngine
        .connect(coll)
        .modifyCollateral(
          flrCollId,
          owner.address,
          COLL_AMOUNT_DEBT.add(COLL_AMOUNT_SUPPLY)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrCollId, PRECISION_PRICE.mul(1));

      await vaultEngine.modifySupply(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_SUPPLY,
        CAPITAL_AMOUNT
      );
      await vaultEngine.modifyDebt(
        flrCollId,
        treasury.address,
        COLL_AMOUNT_DEBT,
        DEBT_AMOUNT
      );

      await registry.connect(gov).setupAddress(bytes32("teller"), user.address);
    });

    it("tests that only teller can call updateAccumulators", async () => {
      const debtToRaise = BigNumber.from("251035088626883475473007");
      const capToRaise = BigNumber.from("125509667994754929166541");

      await assertRevert(
        vaultEngine.updateAccumulators(
          flrCollId,
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
          flrCollId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        );
    });

    it("tests the debt and capital accumulators are properly updated", async () => {
      const collBefore = await vaultEngine.collateralTypes(flrCollId);
      const debtToRaise = BigNumber.from("251035088626883475473007");
      const capToRaise = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrCollId,
          reservePool.address,
          debtToRaise,
          capToRaise,
          BigNumber.from(0)
        );

      const collAfter = await vaultEngine.collateralTypes(flrCollId);
      expect(collBefore.debtAccumulator.add(debtToRaise)).to.equal(
        collAfter.debtAccumulator
      );
      expect(collBefore.capitalAccumulator.add(capToRaise)).to.equal(
        collAfter.capitalAccumulator
      );
    });

    it("fails if new capital + protocolFee is higher than new debt", async () => {
      const debtToRaise = BigNumber.from("251035088626883475473007");
      let capToRaise = debtToRaise.add(1);
      await assertRevert(
        vaultEngine
          .connect(user)
          .updateAccumulators(
            flrCollId,
            reservePool.address,
            debtToRaise,
            capToRaise,
            BigNumber.from(0)
          ),
        "VaultEngine/UpdateAccumulator: new capital created is higher than new debt"
      );

      capToRaise = BigNumber.from("125509667994754929166541");
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrCollId,
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

      const EXPECTED_AUR = protocolFee.mul(CAPITAL_AMOUNT);

      const reserveAurBefore = await vaultEngine.stablecoin(
        reservePool.address
      );
      await vaultEngine
        .connect(user)
        .updateAccumulators(
          flrCollId,
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
