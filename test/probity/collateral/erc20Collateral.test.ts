import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  Erc20Collateral,
  Erc20Token,
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
let erc20Collateral: Erc20Collateral;
let erc20: Erc20Token;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = PRECISION_COLL.mul(100);
const AMOUNT_TO_WITHDRAW = PRECISION_COLL.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("ERC20 Collateral Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployProbity();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    erc20 = contracts.erc20;
    erc20Collateral = contracts.fxrpCollateral;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test Deposit event is emitted properly", async () => {
    await erc20.mint(owner.address, AMOUNT_TO_MINT);
    await erc20.approve(erc20Collateral.address, AMOUNT_TO_MINT);
    const tx = await erc20Collateral.deposit(AMOUNT_TO_MINT);

    let receipt = await tx.wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Deposit";
    });
    expect(event[0].args[0]).to.equal(owner.address);
    expect(event[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("test Withdrawal event is emitted properly", async () => {
    await erc20.mint(owner.address, AMOUNT_TO_MINT);
    await erc20.approve(erc20Collateral.address, AMOUNT_TO_MINT);
    await erc20Collateral.deposit(AMOUNT_TO_MINT);

    const tx = await erc20Collateral.withdraw(AMOUNT_TO_WITHDRAW);

    let receipt = await tx.wait();
    let event = receipt.events?.filter((x) => {
      return x.event == "Withdrawal";
    });
    expect(event[0].args[0]).to.equal(owner.address);
    expect(event[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
