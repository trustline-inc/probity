import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";

import { Treasury, Vault } from "../typechain";
import deploy from "../lib/deploy";
import { expect } from "chai";

// Wallets
let owner: SignerWithAddress;
let alice: SignerWithAddress;

// Contracts
let treasury: Treasury;
let vault: Vault;

describe("Vault", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    treasury = contracts.treasury;
    vault = contracts.vault;

    // Set signers
    alice = signers.alice;
    owner = signers.owner;
  });

  describe("Read-only", function () {
    it("returns a list of vault owners", async function () {
      let users: string[];

      // Expect empty list
      users = await vault.getUsers();
      expect(users).to.have.lengthOf(0);

      // Create a vault
      await treasury.connect(alice).stake(web3.utils.toWei("100"), {
        value: web3.utils.toWei("200"),
      });

      // Expect populated list
      users = await vault.getUsers();
      expect(users).to.have.lengthOf(1);
    });
  });
});
