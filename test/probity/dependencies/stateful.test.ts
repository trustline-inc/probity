import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Stateful, Registry } from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import assertRevert from "../../utils/assertRevert";
import { WAD, bytes32 } from "../../utils/constants";
import { stat } from "fs";
import parseEvents from "../../utils/parseEvents";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let stateful: Stateful;
let registry: Registry;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Stateful Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    stateful = contracts.stateful;
    registry = contracts.registry;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test setState can only be called by gov address", async () => {
    const stateName = bytes32("test");
    await assertRevert(
      stateful.connect(user).setState(stateName, true),
      "AccessControl/onlyBy: Caller does not have permission"
    );

    let state = await stateful.states(stateName);
    expect(state).to.equal(false);

    await stateful.setState(stateName, true);

    state = await stateful.states(stateName);
    expect(state).to.equal(true);
  });

  it("tests that LogStatChange is emitted correctly", async () => {
    const stateName = bytes32("test");

    let parsedEvents = await parseEvents(
      stateful.setState(stateName, true),
      "LogStateChange",
      stateful
    );

    expect(parsedEvents[0].args[0]).to.equal(stateName);
    expect(parsedEvents[0].args[1]).to.equal(true);
  });

  it("test setShutdownState can only be called by shutdown address", async () => {
    const stateName = bytes32("shutdown");
    await assertRevert(
      stateful.setShutdownState(),
      "AccessControl/onlyBy: Caller does not have permission"
    );

    await registry.setupAddress(bytes32("shutdown"), owner.address, false);

    let state = await stateful.states(stateName);
    expect(state).to.equal(false);

    await stateful.setShutdownState();

    state = await stateful.states(stateName);
    expect(state).to.equal(true);
  });

  it("tests that shutdownInitiated is emitted correctly", async () => {
    await registry.setupAddress(bytes32("shutdown"), user.address, false);

    let parsedEvents = await parseEvents(
      stateful.connect(user).setShutdownState(),
      "ShutdownInitiated",
      stateful
    );

    expect(parsedEvents.length).to.equal(1);
  });
});
