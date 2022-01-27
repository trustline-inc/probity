import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { VaultEngine, Registry, NativeToken } from "../../../typechain";

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
let nativeToken: NativeToken;
let vaultEngine: VaultEngine;
let registry: Registry;

const AMOUNT_TO_DEPOSIT = WAD.mul(100);
const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Native Token Unit Test", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    registry = contracts.registry;
    nativeToken = contracts.nativeToken;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.bob;

    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), owner.address);
  });

  it("fails if caller is not a whitelisted user", async () => {
    await assertRevert(
      nativeToken.connect(user).deposit({ value: AMOUNT_TO_DEPOSIT }),
      "AccessControl/onlyByWhiteListed: Access forbidden"
    );

    await registry
      .connect(gov)
      .setupAddress(bytes32("whitelisted"), user.address);
    await nativeToken.connect(user).deposit({ value: AMOUNT_TO_DEPOSIT });
  });

  it("test DepositNativeCrypto event is emitted properly", async () => {
    let parsedEvents = await parseEvents(
      nativeToken.deposit({ value: AMOUNT_TO_DEPOSIT }),
      "DepositNativeCrypto",
      nativeToken
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_DEPOSIT);
  });

  it("test WithdrawNativeCrypto event is emitted properly", async () => {
    await nativeToken.deposit({ value: AMOUNT_TO_DEPOSIT });

    let parsedEvents = await parseEvents(
      nativeToken.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawNativeCrypto",
      nativeToken
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
