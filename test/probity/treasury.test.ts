import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Registry,
  USD,
  Treasury,
  NativeAssetManager,
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
let usd: USD;
let vaultEngine: MockVaultEngine;
let treasury: Treasury;
let registry: Registry;
let flrAsset: NativeAssetManager;

const AMOUNT_TO_MINT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Treasury Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;
    usd = contracts.usd!;
    flrAsset = contracts.nativeAssetManager!;

    owner = signers.owner!;
    user = signers.alice!;

    let param: { [key: string]: string | undefined } = {
      vaultEngine: undefined,
    };

    param.vaultEngine = contracts.mockVaultEngine?.address;
    contracts = await probity.deployTreasury(param);
    treasury = contracts.treasury!;
    vaultEngine = contracts.mockVaultEngine!;

    await registry.register(bytes32("treasury"), owner.address, true);
  });

  describe("depositSystemCurrency Unit Tests", function () {
    beforeEach(async function () {
      await usd.mint(owner.address, AMOUNT_TO_MINT);
    });

    it("tests that deposit calls vaultEngine.addSystemCurrency function", async () => {
      const aurBalanceBefore = await vaultEngine.systemCurrency(owner.address);
      await treasury.depositSystemCurrency(AMOUNT_TO_MINT);
      const aurBalanceAfter = await vaultEngine.systemCurrency(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(
        AMOUNT_TO_MINT.mul(RAY)
      );
    });

    it("tests that usd is burned from user's balance", async () => {
      const aurBalanceBefore = await usd.balanceOf(owner.address);
      await treasury.depositSystemCurrency(AMOUNT_TO_MINT);
      const aurBalanceAfter = await usd.balanceOf(owner.address);
      expect(aurBalanceBefore.sub(aurBalanceAfter)).to.equal(AMOUNT_TO_MINT);
    });

    it("tests that DepositSystemCurrency event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.depositSystemCurrency(AMOUNT_TO_MINT),
        "DepositSystemCurrency",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
    });
  });

  describe("withdrawSystemCurrency Unit Tests", function () {
    beforeEach(async function () {
      await usd.mint(owner.address, AMOUNT_TO_MINT);
      await treasury.depositSystemCurrency(AMOUNT_TO_MINT);
    });

    it("tests that withdrawSystemCurrency calls vaultEngine.removeSystemCurrency function", async () => {
      const aurBalanceBefore = await vaultEngine.systemCurrency(owner.address);
      await treasury.withdrawSystemCurrency(AMOUNT_TO_WITHDRAW);
      const aurBalanceAfter = await vaultEngine.systemCurrency(owner.address);
      expect(aurBalanceBefore.sub(aurBalanceAfter).div(RAY)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("fails when user doesn't have enough aur to be withdrawn", async () => {
      await assertRevert(
        treasury.connect(user).withdrawSystemCurrency(AMOUNT_TO_WITHDRAW),
        "reverted with panic code 0x11"
      );
      await treasury.withdrawSystemCurrency(AMOUNT_TO_WITHDRAW);
    });

    it("tests that usd is minted for user's balance", async () => {
      const aurBalanceBefore = await usd.balanceOf(owner.address);
      await treasury.withdrawSystemCurrency(AMOUNT_TO_WITHDRAW);
      const aurBalanceAfter = await usd.balanceOf(owner.address);
      expect(aurBalanceAfter.sub(aurBalanceBefore)).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("tests that WithdrawSystemCurrency event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.withdrawSystemCurrency(AMOUNT_TO_WITHDRAW),
        "WithdrawSystemCurrency",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
    });
  });

  describe("transferSystemCurrency Unit Tests", function () {
    beforeEach(async function () {
      await vaultEngine.addSystemCurrency(
        owner.address,
        AMOUNT_TO_MINT.mul(RAY)
      );
    });

    it("tests that transferSystemCurrency call vaultEngine.moveSystemCurrency function", async () => {
      const systemCurrencyBalanceBefore = await vaultEngine.systemCurrency(
        user.address
      );
      await treasury.transferSystemCurrency(user.address, AMOUNT_TO_MINT);
      const systemCurrencyBalanceAfter = await vaultEngine.systemCurrency(
        user.address
      );
      expect(
        systemCurrencyBalanceAfter.sub(systemCurrencyBalanceBefore).div(RAY)
      ).to.equal(AMOUNT_TO_MINT);
    });

    it("tests that TransferSystemCurrency event is emitted properly", async () => {
      const parsedEvents = await parseEvents(
        treasury.transferSystemCurrency(user.address, AMOUNT_TO_MINT),
        "TransferSystemCurrency",
        treasury
      );

      expect(parsedEvents[0].args[0]).to.equal(owner.address);
      expect(parsedEvents[0].args[1]).to.equal(user.address);
      expect(parsedEvents[0].args[2]).to.equal(AMOUNT_TO_MINT);
    });
  });

});
