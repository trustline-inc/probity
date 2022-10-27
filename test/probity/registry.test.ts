import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Registry } from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { ADDRESS_ZERO, bytes32, BYTES32_ZERO } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
import parseEvents from "../utils/parseEvents";
const expect = chai.expect;

// Wallets
let user: SignerWithAddress;
let gov: SignerWithAddress;
let user2: SignerWithAddress;

// Contracts
let registry: Registry;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Registry Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry!;

    gov = signers.owner!;
    user = signers.alice!;
    user2 = signers.charlie!;
  });

  describe("setUpAddress Unit Tests", function () {
    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry
          .connect(user)
          .setupAddress(bytes32("test"), user.address, false),
        "callerIsNotGov()"
      );

      await registry
        .connect(gov)
        .setupAddress(bytes32("test"), user.address, false);
    });

    it("tests that proper values are updated", async () => {
      const ROLE_NAME = bytes32("very very special role");
      const ADDRESS = user.address;
      const IS_PROBITY = true;

      const roleBefore = await registry.addressToRole(ADDRESS);
      expect(roleBefore.name).to.equal(BYTES32_ZERO);
      expect(roleBefore.isProbitySystem).to.equal(false);

      await registry.connect(gov).setupAddress(ROLE_NAME, ADDRESS, IS_PROBITY);

      const roleAfter = await registry.addressToRole(ADDRESS);
      expect(roleAfter.name).to.equal(ROLE_NAME);
      expect(roleAfter.isProbitySystem).to.equal(IS_PROBITY);
    });

    it("tests that ContractAdded is emitted properly", async () => {
      const ROLE_NAME = bytes32("very very special role");
      const ADDRESS: string = user.address;
      const IS_PROBITY = false;

      let parsedEvents = await parseEvents(
        registry.setupAddress(ROLE_NAME, ADDRESS, IS_PROBITY),
        "ContractAdded",
        registry
      );

      expect(parsedEvents[0].args[0]).to.equal(ROLE_NAME);
      expect(parsedEvents[0].args[1]).to.equal(ADDRESS);
      expect(parsedEvents[0].args[2]).to.equal(IS_PROBITY);
    });
  });

  describe("removeAddress Unit Tests", function () {
    const ROLE_NAME = bytes32("very very special role");
    let ADDRESS: string;
    const IS_PROBITY = true;

    beforeEach(async function () {
      ADDRESS = user.address;

      await registry.setupAddress(ROLE_NAME, ADDRESS, IS_PROBITY);
    });

    it("fails if caller is not by gov", async () => {
      await assertRevert(
        registry.connect(user).removeAddress(ADDRESS),
        "callerIsNotGov()"
      );

      await registry.connect(gov).removeAddress(ADDRESS);
    });

    it("tests that proper values are updated", async () => {
      const roleBefore = await registry.addressToRole(ADDRESS);
      expect(roleBefore.name).to.equal(ROLE_NAME);
      expect(roleBefore.isProbitySystem).to.equal(IS_PROBITY);

      await registry.connect(gov).removeAddress(ADDRESS);

      const roleAfter = await registry.addressToRole(ADDRESS);
      expect(roleAfter.name).to.equal(BYTES32_ZERO);
      expect(roleAfter.isProbitySystem).to.equal(false);
    });

    it("tests that ContractRemoved is emitted properly", async () => {
      let parsedEvents = await parseEvents(
        registry.removeAddress(ADDRESS),
        "ContractRemoved",
        registry
      );

      expect(parsedEvents[0].args[0]).to.equal(ROLE_NAME);
      expect(parsedEvents[0].args[1]).to.equal(ADDRESS);
    });
  });

  describe("checkIfProbitySystem Unit Tests", function () {
    const ROLE_NAME = bytes32("very very special role");
    const PROBITY_SYSTEM_NAME = bytes32("probity system role");
    let ADDRESS: string;
    let PROBITY_SYSTEM_ADDRESS: string;

    beforeEach(async function () {
      ADDRESS = user.address;
      PROBITY_SYSTEM_ADDRESS = user2.address;

      await registry.setupAddress(ROLE_NAME, ADDRESS, false);
      await registry.setupAddress(
        PROBITY_SYSTEM_NAME,
        PROBITY_SYSTEM_ADDRESS,
        true
      );
    });

    it("tests that it return false for non registered address", async () => {
      const isProbitySystem = await registry.checkIfProbitySystem(ADDRESS_ZERO);
      expect(isProbitySystem).to.equal(false);
    });

    it("tests that it return false for registered but non probity address", async () => {
      const isProbitySystem = await registry.checkIfProbitySystem(ADDRESS);
      expect(isProbitySystem).to.equal(false);
    });

    it("tests that it return true for registered probity system address", async () => {
      const isProbitySystem = await registry.checkIfProbitySystem(
        PROBITY_SYSTEM_ADDRESS
      );
      expect(isProbitySystem).to.equal(true);
    });
  });

  describe("checkIfRegistered Unit Tests", function () {
    const ROLE_NAME = bytes32("very very special role");
    let ADDRESS: string;

    beforeEach(async function () {
      ADDRESS = user.address;

      await registry.setupAddress(ROLE_NAME, ADDRESS, false);
    });

    it("tests that it return false for non registered address", async () => {
      const isProbitySystem = await registry.checkIfRegistered(ADDRESS_ZERO);
      expect(isProbitySystem).to.equal(false);
    });

    it("tests that it return true for registered address", async () => {
      const isProbitySystem = await registry.checkIfRegistered(ADDRESS);
      expect(isProbitySystem).to.equal(true);
    });
  });
});
