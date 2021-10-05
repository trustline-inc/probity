import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  VpToken,
  VpTokenCollateral,
} from "../../../typechain";

import { deployProbity } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { PRECISION_COLL } from "../../utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let vpTokenCollateral: VpTokenCollateral;
let vpToken: VpToken;
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

  it("test Deposit event is emitted properly", async () => {
    await vpToken.mint(owner.address, AMOUNT_TO_MINT);
    await vpToken.approve(vpTokenCollateral.address, AMOUNT_TO_MINT);
    const tx = await vpTokenCollateral.deposit(AMOUNT_TO_MINT);

    let receipt = await tx.wait();

    let events = receipt.events?.filter((x) => {
      return x.event == "Deposit";
    });
    let parsedEvents = events.map((e) =>
      vpTokenCollateral.interface.parseLog(e)
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("test Withdrawal event is emitted properly", async () => {
    await vpToken.mint(owner.address, AMOUNT_TO_MINT);
    await vpToken.approve(vpTokenCollateral.address, AMOUNT_TO_MINT);
    await vpTokenCollateral.deposit(AMOUNT_TO_MINT);

    const tx = await vpTokenCollateral.withdraw(AMOUNT_TO_WITHDRAW);

    let receipt = await tx.wait();

    let events = receipt.events?.filter((x) => {
      return x.event == "Withdrawal";
    });
    let parsedEvents = events.map((e) =>
      vpTokenCollateral.interface.parseLog(e)
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
