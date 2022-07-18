import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  MockErc20AssetManager,
  MockErc20Token,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, WAD } from "../../utils/constants";
import parseEvents from "../../utils/parseEvents";
import assertRevert from "../../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;

// Contracts
let mockErc20AssetManager: MockErc20AssetManager;
let erc20: MockErc20Token;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_MINT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("ERC20 Asset Manager Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine!;
    registry = contracts.registry!;
    erc20 = contracts.mockErc20Token!;
    mockErc20AssetManager = contracts.mockErc20AssetManager!;

    owner = signers.owner!;
    user = signers.alice!;
    gov = signers.bob!;

    await registry.setupAddress(bytes32("gov"), gov.address, true);
    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), owner.address, false);
    await registry
      .connect(gov)
      .setupAddress(
        bytes32("assetManager"),
        mockErc20AssetManager.address,
        true
      );
    await mockErc20AssetManager.setVaultEngine(vaultEngine.address);
  });

  it("fails if token transferFrom failed when depositing", async () => {
    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), user.address, false);

    await assertRevert(
      mockErc20AssetManager.connect(user).deposit(AMOUNT_TO_MINT),
      "ERC20: insufficient allowance"
    );

    await erc20.mint(user.address, AMOUNT_TO_MINT);
    await erc20
      .connect(user)
      .approve(mockErc20AssetManager.address, AMOUNT_TO_MINT);

    await mockErc20AssetManager.connect(user).deposit(AMOUNT_TO_MINT);
  });

  it("fails if caller is not a whitelisted user", async () => {
    await erc20.mint(user.address, AMOUNT_TO_MINT);
    await erc20
      .connect(user)
      .approve(mockErc20AssetManager.address, AMOUNT_TO_MINT);

    await assertRevert(
      mockErc20AssetManager.connect(user).deposit(AMOUNT_TO_MINT),
      "AccessControl/onlyBy: Caller does not have permission"
    );

    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), user.address, false);
    await mockErc20AssetManager.connect(user).deposit(AMOUNT_TO_MINT);
  });

  it("test DepositToken event is emitted properly", async () => {
    await erc20.mint(owner.address, AMOUNT_TO_MINT);
    await erc20.approve(mockErc20AssetManager.address, AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      mockErc20AssetManager.deposit(AMOUNT_TO_MINT),
      "DepositToken",
      mockErc20AssetManager
    );

    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("fails if token transfer failed when withdrawing", async () => {
    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), user.address, false);

    await erc20.mint(user.address, AMOUNT_TO_MINT);
    await erc20
      .connect(user)
      .approve(mockErc20AssetManager.address, AMOUNT_TO_MINT);

    await mockErc20AssetManager.connect(user).deposit(AMOUNT_TO_MINT);

    await erc20.burn(mockErc20AssetManager.address, AMOUNT_TO_MINT);

    await assertRevert(
      mockErc20AssetManager.connect(user).withdraw(AMOUNT_TO_MINT),
      "ERC20: transfer amount exceeds balance"
    );
  });

  it("test WithdrawToken event is emitted properly", async () => {
    await erc20.mint(owner.address, AMOUNT_TO_MINT);
    await erc20.approve(mockErc20AssetManager.address, AMOUNT_TO_MINT);
    await mockErc20AssetManager.deposit(AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      mockErc20AssetManager.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawToken",
      mockErc20AssetManager
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
