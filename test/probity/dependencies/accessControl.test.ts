import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Stateful, Registry, AccessControl } from "../../../typechain";

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
let newRegistryAddress: SignerWithAddress;

// Contracts
let accessControl: AccessControl;
let registry: Registry;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("AccessControl Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    accessControl = contracts.accessControl!;
    registry = contracts.registry!;

    owner = signers.owner!;
    user = signers.alice!;
    newRegistryAddress = signers.charlie!;
  });

  it("test that only admin can change registry address", async () => {
    await assertRevert(
      accessControl
        .connect(user)
        .setRegistryAddress(newRegistryAddress.address),
      "callerDoesNotHaveRequiredRole"
    );
    await registry.register(bytes32("admin"), user.address, true);

    await accessControl
      .connect(user)
      .setRegistryAddress(newRegistryAddress.address);
  });
});
