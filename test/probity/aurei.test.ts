import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Aurei, VaultEngine, TcnToken, Registry } from "../../typechain";

import { deployProbity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import assertRevert from "../utils/assertRevert";
import { PRECISION_COLL, bytes32 } from "../utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = PRECISION_COLL.mul(1000);
const AMOUNT_TO_BURN = PRECISION_COLL.mul(230);
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Aurei Token Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployProbity();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    aurei = contracts.aurei;
    registry = contracts.registry;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test mint can only be called by vault contract", async () => {
    await assertRevert(
      aurei.mint(user.address, AMOUNT_TO_MINT),
      "ACCESS: Caller does not have authority to call this"
    );

    // add owner to registry as 'vault' then check if owner can now mint
    await registry.setupContractAddress(bytes32("treasury"), owner.address);

    const balanceBefore = await aurei.balanceOf(user.address);

    await aurei.mint(user.address, AMOUNT_TO_MINT);

    const balanceAfter = await aurei.balanceOf(user.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(AMOUNT_TO_MINT);
  });

  it("test burn can only be called by vault contract", async () => {
    // add owner to registry as 'vault' then check if owner can now mint
    await registry.setupContractAddress(bytes32("treasury"), owner.address);

    await aurei.mint(user.address, AMOUNT_TO_MINT);

    await assertRevert(
      aurei.connect(user).burn(user.address, AMOUNT_TO_BURN),
      "ACCESS: Caller does not have authority to call this"
    );

    const balanceBefore = await aurei.balanceOf(user.address);

    await aurei.burn(user.address, AMOUNT_TO_BURN);

    const balanceAfter = await aurei.balanceOf(user.address);
    expect(balanceBefore.sub(balanceAfter)).to.equal(AMOUNT_TO_BURN);
  });
});
