import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { USD, VaultEngine, PBT, Registry } from "../../../typechain";

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
let vaultEngine: VaultEngine;
let registry: Registry;
let pbt: PBT;

const AMOUNT_TO_MINT = WAD.mul(1000);
const AMOUNT_TO_BURN = WAD.mul(230);
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("PBT Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine!;
    pbt = contracts.pbt!;
    registry = contracts.registry!;

    owner = signers.owner!;
    user = signers.alice!;
  });

  it("test mint can only be called by vault contract", async () => {
    await assertRevert(
      pbt.mint(user.address, AMOUNT_TO_MINT),
      "callerDoesNotHaveRequiredRole"
    );

    // add owner to registry as 'treasury' then check if owner can now mint
    await registry.setupAddress(bytes32("treasury"), owner.address, true);

    const balanceBefore = await pbt.balanceOf(user.address);

    await pbt.mint(user.address, AMOUNT_TO_MINT);

    const balanceAfter = await pbt.balanceOf(user.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(AMOUNT_TO_MINT);
  });

  it("test that transfer is not allowed", async () => {
    await registry.setupAddress(bytes32("treasury"), owner.address, true);

    await pbt.mint(user.address, AMOUNT_TO_MINT);

    await assertRevert(
      pbt.connect(user).transfer(owner.address, AMOUNT_TO_MINT),
      "Transfer is disabled for PBT token"
    );
  });

  it("test that approve is not allowed", async () => {
    await registry.setupAddress(bytes32("treasury"), owner.address, true);

    await pbt.mint(user.address, AMOUNT_TO_MINT);

    await assertRevert(
      pbt.connect(user).approve(owner.address, AMOUNT_TO_MINT),
      "Approve is disabled for PBT token"
    );
  });

  it("test burn can only be called by vault contract", async () => {
    // add owner to registry as 'treasury' then check if owner can now mint
    await registry.setupAddress(bytes32("treasury"), owner.address, true);

    await pbt.mint(user.address, AMOUNT_TO_MINT);

    await assertRevert(
      pbt.connect(user).burn(user.address, AMOUNT_TO_BURN),
      "callerDoesNotHaveRequiredRole"
    );

    const balanceBefore = await pbt.balanceOf(user.address);

    await pbt.burn(user.address, AMOUNT_TO_BURN);

    const balanceAfter = await pbt.balanceOf(user.address);
    expect(balanceBefore.sub(balanceAfter)).to.equal(AMOUNT_TO_BURN);
  });
});
