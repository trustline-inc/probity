import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { VaultEngine, Registry } from "../../../typechain";

import { deployProbity } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { PRECISION_COLL } from "../../utils/constants";
import { FlrCollateral } from "../../../typechain/FlrCollateral";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let nativeCollataral: FlrCollateral;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_DEPOSIT = PRECISION_COLL.mul(100);
const AMOUNT_TO_WITHDRAW = PRECISION_COLL.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Native Collateral Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployProbity();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    nativeCollataral = contracts.nativeCollateral;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test Deposit event is emitted properly", async () => {
    const tx = await nativeCollataral.deposit({ value: AMOUNT_TO_DEPOSIT });

    let receipt = await tx.wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Deposit";
    });
    expect(event[0].args[0]).to.equal(owner.address);
    expect(event[0].args[1]).to.equal(AMOUNT_TO_DEPOSIT);
  });

  it("test Withdrawal event is emitted properly", async () => {
    await nativeCollataral.deposit({ value: AMOUNT_TO_DEPOSIT });

    const tx = await nativeCollataral.withdraw(AMOUNT_TO_WITHDRAW);

    let receipt = await tx.wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Withdrawal";
    });
    expect(event[0].args[0]).to.equal(owner.address);
    expect(event[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
