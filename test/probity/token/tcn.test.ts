import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { Aurei, VaultEngine, TcnToken, Registry } from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import assertRevert from "../../utils/assertRevert";
import { PRECISION_COLL, bytes32 } from "../../utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let vaultEngine: VaultEngine;
let registry: Registry;
let tcn: TcnToken;

const AMOUNT_TO_MINT = PRECISION_COLL.mul(1000);
const AMOUNT_TO_BURN = PRECISION_COLL.mul(230);
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("TCN Token Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    tcn = contracts.tcnToken;
    registry = contracts.registry;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test mint can only be called by vault contract", async () => {
    await assertRevert(
      tcn.mint(user.address, AMOUNT_TO_MINT),
      "ACCESS: Caller does not have permission"
    );

    // add owner to registry as 'treasury' then check if owner can now mint
    await registry.setupContractAddress(bytes32("treasury"), owner.address);

    const balanceBefore = await tcn.balanceOf(user.address);

    await tcn.mint(user.address, AMOUNT_TO_MINT);

    const balanceAfter = await tcn.balanceOf(user.address);
    expect(balanceAfter.sub(balanceBefore)).to.equal(AMOUNT_TO_MINT);
  });

  it("test burn can only be called by vault contract", async () => {
    // add owner to registry as 'treasury' then check if owner can now mint
    await registry.setupContractAddress(bytes32("treasury"), owner.address);

    await tcn.mint(user.address, AMOUNT_TO_MINT);

    await assertRevert(
      tcn.connect(user).burn(user.address, AMOUNT_TO_BURN),
      "ACCESS: Caller does not have permission"
    );

    const balanceBefore = await tcn.balanceOf(user.address);

    await tcn.burn(user.address, AMOUNT_TO_BURN);

    const balanceAfter = await tcn.balanceOf(user.address);
    expect(balanceBefore.sub(balanceAfter)).to.equal(AMOUNT_TO_BURN);
  });
});
