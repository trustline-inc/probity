import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { MockVaultEngine, Registry, Teller } from "../../typechain";

import { deployTest, probity, mock } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY } from "../utils/constants";
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

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Bonds Unit Tests", function () {
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

  describe("vouchersPerStablecoin Unit Tests", function () {
    it("tests that price increase correctly at each steps", async () => {});

    it("tests that it doesn't go over max values", async () => {});
  });

  describe("setReservePoolAddress Unit Tests", function () {
    it("fails if caller is not 'gov'", async () => {});

    it("fails if reservePoolAddress has already been set", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("updateSaleMaxPrice Unit Tests", function () {
    it("fails if caller is not 'gov'", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("updateSaleStepPeriod Unit Tests", function () {
    it("fails if caller is not gov", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("updateSalePriceIncreasePerStep Unit Tests", function () {
    it("fails if caller is not by gov", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("newOffering Unit Tests", function () {
    it("fails if caller is not by reservePool", async () => {});

    it("fails if current Offering is not over yet", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("shutdownRedemption Unit Tests", function () {
    it("fails if contract is not in shutdown state", async () => {});

    it("fails if caller is not by shutdown", async () => {});

    it("fails if caller is not by shutdown", async () => {});

    it("fails if caller is not by shutdown", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("purchaseVouchers Unit Tests", function () {
    it("fails if contract is not in shutdown state", async () => {});

    it("fails if caller is not by shutdown", async () => {});

    it("tests that values are properly set", async () => {});
  });

  describe("redeemVouchers Unit Tests", function () {
    it("tests that values are properly set", async () => {});
  });
});
