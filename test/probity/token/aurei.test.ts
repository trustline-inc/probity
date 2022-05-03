import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Aurei, VaultEngine, Registry } from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import assertRevert from "../../utils/assertRevert";
import { WAD, bytes32 } from "../../utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = WAD.mul(1000);
const AMOUNT_TO_BURN = WAD.mul(230);
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Aurei Token Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

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
      "AccessControl/onlyBy: Caller does not have permission"
    );

    // add owner to registry as 'treasury' then check if owner can now mint
    await registry.setupAddress(bytes32("treasury"), owner.address, true);

    const balanceBefore = await aurei.balanceOf(user.address);

    await aurei.mint(user.address, AMOUNT_TO_MINT);

    const balanceAfter = await aurei.balanceOf(user.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(AMOUNT_TO_MINT);
  });

  it("test burn can only be called by vault contract", async () => {
    // add owner to registry as 'treasury' then check if owner can now mint
    await registry.setupAddress(bytes32("treasury"), owner.address, true);

    await aurei.mint(user.address, AMOUNT_TO_MINT);

    await assertRevert(
      aurei.connect(user).burn(user.address, AMOUNT_TO_BURN),
      "AccessControl/onlyBy: Caller does not have permission"
    );

    const balanceBefore = await aurei.balanceOf(user.address);

    await aurei.burn(user.address, AMOUNT_TO_BURN);

    const balanceAfter = await aurei.balanceOf(user.address);
    expect(balanceBefore.sub(balanceAfter)).to.equal(AMOUNT_TO_BURN);
  });

  it("tests that token can not be transferred when contract is paused", async () => {
    await registry.setupAddress(bytes32("treasury"), user.address, true);

    const balanceBefore = await aurei.balanceOf(user.address);

    await aurei.connect(user).mint(user.address, AMOUNT_TO_MINT);

    const balanceAfter = await aurei.balanceOf(user.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(AMOUNT_TO_MINT);

    await aurei.setState(bytes32("paused"), true);

    await assertRevert(
      aurei.connect(user).transfer(owner.address, AMOUNT_TO_MINT),
      "Stateful/onlyWhen: State check failed"
    );
  });
});
