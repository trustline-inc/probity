import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Registry,
  Aurei,
  PbtToken,
  Treasury,
  NativeToken,
  MockVaultEngine,
} from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, WAD, RAY, RAD } from "../utils/constants";
import parseEvents from "../utils/parseEvents";
import assertRevert from "../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let aurei: Aurei;
let pbt: PbtToken;
let vaultEngine: MockVaultEngine;
let treasury: Treasury;
let registry: Registry;
let flrCollateral: NativeToken;

const AMOUNT_TO_MINT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Treasury Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    aurei = contracts.aurei;
    pbt = contracts.pbtToken;
    flrCollateral = contracts.nativeToken;

    owner = signers.owner;
    user = signers.alice;

    let param = {
      vaultEngine: null,
    };

    param.vaultEngine = contracts.mockVaultEngine.address;
    contracts = await probity.deployTreasury(param);
    treasury = contracts.treasury;
    vaultEngine = contracts.mockVaultEngine;

    await registry.setupAddress(bytes32("treasury"), owner.address);
  });

  describe("depositStablecoin Unit Tests", function () {
    beforeEach(async function () {
      await aurei.mint(owner.address, AMOUNT_TO_MINT);
    });

    it("tests that deposit calls vaultEngine.addStablecoin function", async () => {
      const aurBalanceBefore = await vaultEngine.stablecoin(owner.address);
      await treasury.depositStablecoin(AMOUNT_TO_MINT);
      const aurBalanceAfter = await vaultEngine.stablecoin(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(
        AMOUNT_TO_MINT.mul(RAY)
      );
    });

    it("tests that aurei is burned from user's balance", async () => {
      const aurBalanceBefore = await aurei.balanceOf(owner.address);
      await treasury.depositStablecoin(AMOUNT_TO_MINT);
      const aurBalanceAfter = await aurei.balanceOf(owner.address);
      expect(aurBalanceBefore.sub(aurBalanceAfter)).to.equal(AMOUNT_TO_MINT);
    });

    it("tests that DepositStablecoin event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.depositStablecoin(AMOUNT_TO_MINT),
        "DepositStablecoin",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
    });
  });

  describe("withdrawStablecoin Unit Tests", function () {
    beforeEach(async function () {
      await aurei.mint(owner.address, AMOUNT_TO_MINT);
      await treasury.depositStablecoin(AMOUNT_TO_MINT);
    });

    it("tests that withdrawStablecoin calls vaultEngine.removeStablecoin function", async () => {
      const aurBalanceBefore = await vaultEngine.stablecoin(owner.address);
      await treasury.withdrawStablecoin(AMOUNT_TO_WITHDRAW);
      const aurBalanceAfter = await vaultEngine.stablecoin(owner.address);
      expect(aurBalanceBefore.sub(aurBalanceAfter).div(RAY)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("fails when user doesn't have enough aur to be withdrawn", async () => {
      await assertRevert(
        treasury.connect(user).withdrawStablecoin(AMOUNT_TO_WITHDRAW),
        "reverted with panic code 0x11"
      );
      await treasury.withdrawStablecoin(AMOUNT_TO_WITHDRAW);
    });

    it("tests that aurei is minted for user's balance", async () => {
      const aurBalanceBefore = await aurei.balanceOf(owner.address);
      await treasury.withdrawStablecoin(AMOUNT_TO_WITHDRAW);
      const aurBalanceAfter = await aurei.balanceOf(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that WithdrawStablecoin event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.withdrawStablecoin(AMOUNT_TO_WITHDRAW),
        "WithdrawStablecoin",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
    });
  });

  describe("withdrawPbt Unit Tests", function () {
    beforeEach(async function () {
      await vaultEngine.addPbt(owner.address, AMOUNT_TO_MINT.mul(RAY));
    });

    it("tests that withdrawPbt call vaultEngine.reducePbt function", async () => {
      const pbtBalanceBefore = await vaultEngine.pbt(owner.address);
      await treasury.withdrawPbt(AMOUNT_TO_WITHDRAW);
      const pbtBalanceAfter = await vaultEngine.pbt(owner.address);
      expect(pbtBalanceBefore.sub(pbtBalanceAfter).div(RAY)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that pbt is minted for user's balance", async () => {
      const pbtBalanceBefore = await pbt.balanceOf(owner.address);
      await treasury.withdrawPbt(AMOUNT_TO_WITHDRAW);
      const pbtBalanceAfter = await pbt.balanceOf(owner.address);
      expect(pbtBalanceAfter.sub(pbtBalanceBefore)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that WithdrawPbt event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.withdrawPbt(AMOUNT_TO_WITHDRAW),
        "WithdrawPbt",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
    });
  });
});
