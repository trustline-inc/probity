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
    stateful = contracts.stateful!;
    registry = contracts.registry!;

    owner = signers.owner!;
    user = signers.alice!;
  });

  it("test setState can only be called by admin address", async () => {
    const stateName = bytes32("test");
    await assertRevert(
      stateful.connect(user).setState(stateName, true),
      "callerDoesNotHaveRequiredRole"
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
});
