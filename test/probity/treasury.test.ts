import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Registry,
  Aurei,
  TcnToken,
  Treasury,
  NativeCollateral,
  MockVaultEngine,
} from "../../typechain";

import { deployProbity, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, PRECISION_COLL } from "../utils/constants";
import parseEvents from "../utils/parseEvents";
import assertRevert from "../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let aurei: Aurei;
let tcn: TcnToken;
let vaultEngine: MockVaultEngine;
let treasury: Treasury;
let registry: Registry;
let flrCollateral: NativeCollateral;

const AMOUNT_TO_MINT = PRECISION_COLL.mul(100);
const AMOUNT_TO_WITHDRAW = PRECISION_COLL.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Treasury Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployProbity();
    // Set contracts
    registry = contracts.registry;
    aurei = contracts.aurei;
    tcn = contracts.tcnToken;
    flrCollateral = contracts.nativeCollateral;

    owner = signers.owner;
    user = signers.alice;

    let param = {
      registry,
      aurei,
      tcnToken: tcn,
      vaultEngine: null,
    };

    contracts = await mock.deployMockVaultEngine();
    param.vaultEngine = contracts.mockVault;
    contracts = await probity.deployTreasury(param);
    treasury = contracts.treasury;
    vaultEngine = contracts.mockVault;

    await registry.setupContractAddress(bytes32("treasury"), owner.address);
  });

  describe("depositAurei Unit Tests", function () {
    beforeEach(async function () {
      await aurei.mint(owner.address, AMOUNT_TO_MINT);
    });

    it("tests that deposit call vaultEngine.addAurei function", async () => {
      const aurBalanceBefore = await vaultEngine.AUR(owner.address);
      await treasury.deposit(AMOUNT_TO_MINT);
      const aurBalanceAfter = await vaultEngine.AUR(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(AMOUNT_TO_MINT);
    });

    it("tests that aurei is burned from user's balance", async () => {
      const aurBalanceBefore = await aurei.balanceOf(owner.address);
      await treasury.deposit(AMOUNT_TO_MINT);
      const aurBalanceAfter = await aurei.balanceOf(owner.address);
      expect(aurBalanceBefore.sub(aurBalanceAfter)).to.equal(AMOUNT_TO_MINT);
    });

    it("tests that Deposit event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.deposit(AMOUNT_TO_MINT),
        "Deposit",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
    });
  });

  describe("withdrawalAurei Unit Tests", function () {
    beforeEach(async function () {
      await aurei.mint(owner.address, AMOUNT_TO_MINT);
      await treasury.deposit(AMOUNT_TO_MINT);
    });

    it("tests that withdrawAurei call vaultEngine.removeAurei function", async () => {
      const aurBalanceBefore = await vaultEngine.AUR(owner.address);
      await treasury.withdrawAurei(AMOUNT_TO_WITHDRAW);
      const aurBalanceAfter = await vaultEngine.AUR(owner.address);
      expect(aurBalanceBefore.sub(aurBalanceAfter)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("fails when user doesn't have enough aur to be withdrawn ", async () => {
      await assertRevert(
        treasury.connect(user).withdrawAurei(AMOUNT_TO_WITHDRAW),
        "reverted with panic code 0x11"
      );
      await treasury.withdrawAurei(AMOUNT_TO_WITHDRAW);
    });

    it("tests that aurei is minted for user's balance", async () => {
      const aurBalanceBefore = await aurei.balanceOf(owner.address);
      await treasury.withdrawAurei(AMOUNT_TO_WITHDRAW);
      const aurBalanceAfter = await aurei.balanceOf(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that Withdrawal event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.withdrawAurei(AMOUNT_TO_WITHDRAW),
        "Withdrawal",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
    });
  });

  describe("withdrawTcn Unit Tests", function () {
    beforeEach(async function () {
      await vaultEngine.addTcn(owner.address, AMOUNT_TO_MINT);
    });

    it("tests that withdrawTcn call vaultEngine.reduceYield function", async () => {
      const tcnBalanceBefore = await vaultEngine.TCN(owner.address);
      await treasury.withdrawTcn(AMOUNT_TO_WITHDRAW);
      const tcnBalanceAfter = await vaultEngine.TCN(owner.address);
      expect(tcnBalanceBefore.sub(tcnBalanceAfter)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that tcn is minted for user's balance", async () => {
      const tcnBalanceBefore = await tcn.balanceOf(owner.address);
      await treasury.withdrawTcn(AMOUNT_TO_WITHDRAW);
      const tcnBalanceAfter = await tcn.balanceOf(owner.address);
      expect(tcnBalanceAfter.sub(tcnBalanceBefore)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that Withdrawal event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.withdrawTcn(AMOUNT_TO_WITHDRAW),
        "TcnWithdrawal",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
    });
  });

  describe("tradeTcnforAurei Unit Tests", function () {
    beforeEach(async function () {
      await tcn.mint(owner.address, AMOUNT_TO_MINT);
    });

    it("tests that tcn is burned and aurei is minted properly", async () => {
      const aurBalanceBefore = await aurei.balanceOf(owner.address);
      const tcnBalanceBefore = await tcn.balanceOf(owner.address);
      await treasury.tradeTcnforAurei(AMOUNT_TO_MINT);
      const aurBalanceAfter = await aurei.balanceOf(owner.address);
      const tcnBalanceAfter = await tcn.balanceOf(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(AMOUNT_TO_MINT);
      expect(tcnBalanceBefore.sub(tcnBalanceAfter)).to.equal(AMOUNT_TO_MINT);
    });

    it("tests that TCNTradedForAurei is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.tradeTcnforAurei(AMOUNT_TO_WITHDRAW),
        "TcnForAur",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
    });
  });
});