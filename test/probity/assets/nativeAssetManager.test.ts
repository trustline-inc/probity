import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { VaultEngine, Registry, NativeAssetManager } from "../../../typechain";

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
let nativeAssetManager: NativeAssetManager;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_DEPOSIT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Native Asset Manager Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    nativeAssetManager = contracts.nativeAssetManager;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.bob;

    await registry.setupAddress(bytes32("gov"), gov.address, true);
    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), owner.address, false);
  });

  it("fails if caller is not a whitelisted user", async () => {
    await assertRevert(
      nativeAssetManager.connect(user).deposit({ value: AMOUNT_TO_DEPOSIT }),
      "AccessControl/onlyBy: Caller does not have permission"
    );

    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), user.address, false);
    await nativeAssetManager
      .connect(user)
      .deposit({ value: AMOUNT_TO_DEPOSIT });
  });

  it("test DepositNativeCrypto event is emitted properly", async () => {
    let parsedEvents = await parseEvents(
      nativeAssetManager.deposit({ value: AMOUNT_TO_DEPOSIT }),
      "DepositNativeCrypto",
      nativeAssetManager
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_DEPOSIT);
  });

  it("test WithdrawNativeCrypto event is emitted properly", async () => {
    await nativeAssetManager.deposit({ value: AMOUNT_TO_DEPOSIT });

    let parsedEvents = await parseEvents(
      nativeAssetManager.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawNativeCrypto",
      nativeAssetManager
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
