import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  MockVPToken,
  VPToken,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import parseEvents from "../../utils/parseEvents";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, WAD } from "../../utils/constants";
import assertRevert from "../../utils/assertRevert";

const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;

// Contracts
let vpToken: VPToken;
let mockVpToken: MockVPToken;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("VP Token  Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    vpToken = contracts.vpToken;
    mockVpToken = contracts.mockVpToken;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.bob;

    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), owner.address);
  });

  it("fails if caller is not a whitelisted user", async () => {
    await mockVpToken.mint(user.address, AMOUNT_TO_MINT);
    await mockVpToken.connect(user).approve(vpToken.address, AMOUNT_TO_MINT);

    await assertRevert(
      vpToken.connect(user).deposit(AMOUNT_TO_MINT),
      "AccessControl/onlyByWhiteListed: Access forbidden"
    );

    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), user.address);
    await vpToken.connect(user).deposit(AMOUNT_TO_MINT);
  });

  it("test DepositVPToken event is emitted properly", async () => {
    await mockVpToken.mint(owner.address, AMOUNT_TO_MINT);
    await mockVpToken.approve(vpToken.address, AMOUNT_TO_MINT);
    let parsedEvents = await parseEvents(
      vpToken.deposit(AMOUNT_TO_MINT),
      "DepositVPToken",
      vpToken
    );

    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("test WithdrawVPToken event is emitted properly", async () => {
    await mockVpToken.mint(owner.address, AMOUNT_TO_MINT);
    await mockVpToken.approve(vpToken.address, AMOUNT_TO_MINT);
    await vpToken.deposit(AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      vpToken.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawVPToken",
      vpToken
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
