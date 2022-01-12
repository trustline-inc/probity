import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  ERC20Token,
  MockERC20Token,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { WAD } from "../../utils/constants";
import parseEvents from "../../utils/parseEvents";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let erc20Token: ERC20Token;
let erc20: MockERC20Token;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("ERC20 Collateral Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    erc20 = contracts.mockErc20Token;
    erc20Token = contracts.erc20Token;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test DepositToken event is emitted properly", async () => {
    await erc20.mint(owner.address, AMOUNT_TO_MINT);
    await erc20.approve(erc20Token.address, AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      erc20Token.deposit(AMOUNT_TO_MINT),
      "DepositToken",
      erc20Token
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("test WithdrawToken event is emitted properly", async () => {
    await erc20.mint(owner.address, AMOUNT_TO_MINT);
    await erc20.approve(erc20Token.address, AMOUNT_TO_MINT);
    await erc20Token.deposit(AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      erc20Token.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawToken",
      erc20Token
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
