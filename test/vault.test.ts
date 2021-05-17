import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

import { Teller, Treasury, Vault } from "../typechain";
import deploy from "../lib/deploy";

// Wallets
let alice: SignerWithAddress;
let bob: SignerWithAddress;

// Contracts
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

describe("Vault", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    teller = contracts.teller;
    treasury = contracts.treasury;
    vault = contracts.vault;

    // Set signers
    alice = signers.alice;
    bob = signers.bob;
  });

  describe("Vault Initialization", function () {
    it("Creates a vault with collateral", async () => {
      const collateral = 1000;

      // Create Alice's vault
      await vault.connect(alice).deposit({
        value: web3.utils.toWei(collateral.toString()),
      });

      // Check Alice's vault details
      const _vault = await vault.connect(alice).get(alice.address);
      expect(web3.utils.fromWei(_vault[0].toString())).to.equal(
        collateral.toString()
      );
      expect(web3.utils.fromWei(_vault[1].toString())).to.equal("0");

      // Check Alice's equity and debt balances
      expect(await treasury.capitalOf(alice.address)).to.equal("0");
      expect(await teller.balanceOf(alice.address)).to.equal("0");
    });

    it("Creates a vault without collateral", async () => {
      const collateral = 0;

      // Create Bob's vault
      await vault.connect(bob).deposit({
        value: web3.utils.toWei(collateral.toString()),
      });

      // Check Bob's vault details
      const _vault = await vault.connect(bob).get(bob.address);
      expect(web3.utils.fromWei(_vault[0].toString())).to.equal(
        collateral.toString()
      );
      expect(web3.utils.fromWei(_vault[1].toString())).to.equal("0");

      // Check Bob's equity and debt balances
      expect(await treasury.capitalOf(bob.address)).to.equal("0");
      expect(await teller.balanceOf(bob.address)).to.equal("0");
    });
  });

  describe("Vault Management", function () {
    it("Allows a user to deposits additional collateral", async () => {
      const collateral = 1000;

      // Alice deposits 1000 additional units of collateral (2000 new total)
      await vault.connect(alice).deposit({
        value: web3.utils.toWei(collateral.toString()),
      });

      // Check Alice's vault details
      const _vault = await vault.connect(alice).get(alice.address);
      expect(web3.utils.fromWei(_vault[0].toString())).to.equal("2000");
      expect(web3.utils.fromWei(_vault[1].toString())).to.equal("0");
    });

    it("Allows a user to withdraw unencumbered collateral", async () => {
      const collateral = 1000;

      // Alice withdraws 1000 units of collateral (1000 new total)
      await vault
        .connect(alice)
        .withdraw(web3.utils.toWei(collateral.toString()));

      // Check Alice's vault details
      const _vault = await vault.connect(alice).get(alice.address);
      expect(web3.utils.fromWei(_vault[0].toString())).to.equal("1000");
      expect(web3.utils.fromWei(_vault[1].toString())).to.equal("0");
    });

    it("Fails to withdraw an overdraft", async () => {
      const collateral = 1000;

      // Bob attempts to withdraw 1000 units of collateral (-1000 new total)
      await expect(
        vault.connect(bob).withdraw(web3.utils.toWei(collateral.toString()))
      ).to.be.revertedWith("VAULT: Overdraft not allowed.");

      // Check Bob's vault details
      const _vault = await vault.connect(bob).get(bob.address);
      expect(web3.utils.fromWei(_vault[0].toString())).to.equal("0");
      expect(web3.utils.fromWei(_vault[1].toString())).to.equal("0");
    });

    it("Fails to withdraw encumbered collateral", async () => {
      const equityCollateral = 1000;
      const equity = 500;
      const withdrawSize = 1000;

      // Alice encumbers her collateral
      treasury
        .connect(alice)
        .stake(
          web3.utils.toWei(equityCollateral.toString()),
          web3.utils.toWei(equity.toString())
        );

      // Alice attempts to withdraw encumbered collateral
      await expect(
        vault.connect(alice).withdraw(web3.utils.toWei(withdrawSize.toString()))
      ).to.be.revertedWith("VAULT: Overdraft not allowed.");
    });
  });
});
