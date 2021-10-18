import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { VaultEngine, Registry, NativeCollateral } from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { PRECISION_COLL } from "../../utils/constants";
import parseEvents from "../../utils/parseEvents";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let nativeCollataral: NativeCollateral;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_DEPOSIT = PRECISION_COLL.mul(100);
const AMOUNT_TO_WITHDRAW = PRECISION_COLL.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Native Collateral Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    nativeCollataral = contracts.nativeCollateral;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test Deposit event is emitted properly", async () => {
    let parsedEvents = await parseEvents(
      nativeCollataral.deposit({ value: AMOUNT_TO_DEPOSIT }),
      "Deposit",
      nativeCollataral
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_DEPOSIT);
  });

  it("test Withdrawal event is emitted properly", async () => {
    await nativeCollataral.deposit({ value: AMOUNT_TO_DEPOSIT });

    let parsedEvents = await parseEvents(
      nativeCollataral.withdraw(AMOUNT_TO_WITHDRAW),
      "Withdrawal",
      nativeCollataral
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
