import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  MockVpToken,
  VpTokenCollateral,
} from "../../../typechain";

import { deployProbity } from "../../../lib/deployer";
import parseEvents from "../../utils/parseEvents";
import { ethers } from "hardhat";
import * as chai from "chai";
import { PRECISION_COLL } from "../../utils/constants";

const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let vpTokenCollateral: VpTokenCollateral;
let vpToken: MockVpToken;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = PRECISION_COLL.mul(100);
const AMOUNT_TO_WITHDRAW = PRECISION_COLL.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("VP Token Collateral Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployProbity();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    vpToken = contracts.vpToken;
    vpTokenCollateral = contracts.vpTokenCollateral;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test DepositVPToken event is emitted properly", async () => {
    await vpToken.mint(owner.address, AMOUNT_TO_MINT);
    await vpToken.approve(vpTokenCollateral.address, AMOUNT_TO_MINT);
    let parsedEvents = await parseEvents(
      vpTokenCollateral.deposit(AMOUNT_TO_MINT),
      "DepositVPToken",
      vpTokenCollateral
    );

    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("test WithdrawVPToken event is emitted properly", async () => {
    await vpToken.mint(owner.address, AMOUNT_TO_MINT);
    await vpToken.approve(vpTokenCollateral.address, AMOUNT_TO_MINT);
    await vpTokenCollateral.deposit(AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      vpTokenCollateral.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawVPToken",
      vpTokenCollateral
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
