import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Registry } from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, BYTES32_ZERO } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import parseEvents from "../utils/parseEvents";
const expect = chai.expect;

// Wallets
let user: SignerWithAddress;
let gov: SignerWithAddress;

// Contracts
let registry: Registry;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Registry Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;

    gov = signers.owner;
    user = signers.alice;
  });

  describe("initAsset Unit Tests", function () {
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry
          .connect(user)
          .setupAddress(bytes32("test"), user.address, false),
        "Registry/onlyByGov: caller is not from 'gov' address"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("test"), user.address, false);
    });
  });

  describe("updateLiquidationRatio Unit Tests", function () {
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry
          .connect(user)
          .setupAddress(bytes32("test"), user.address, false),
        "Registry/onlyByGov: caller is not from 'gov' address"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("test"), user.address, false);
    });
  });

  describe("updateFtso Unit Tests", function () {
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry
          .connect(user)
          .setupAddress(bytes32("test"), user.address, false),
        "Registry/onlyByGov: caller is not from 'gov' address"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("test"), user.address, false);
    });
  });

  describe("getPrice Unit Tests", function () {
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry
          .connect(user)
          .setupAddress(bytes32("test"), user.address, false),
        "Registry/onlyByGov: caller is not from 'gov' address"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("test"), user.address, false);
    });
  });

  describe("updateAdjustedPrice Unit Tests", function () {
    const ROLE_NAME = bytes32("very very special role");
    let ADDRESS;
    const IS_PROBITY = true;

    beforeEach(async function () {
      ADDRESS = user.address;

      await registry.setupAddress(ROLE_NAME, ADDRESS, IS_PROBITY);
    });

    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry.connect(user).removeAddress(ADDRESS),
        "Registry/onlyByGov: caller is not from 'gov' address"
      );

      await registry.connect(gov).removeAddress(ADDRESS);
    });
  });
});
