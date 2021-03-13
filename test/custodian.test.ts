import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Probity, Teller, Treasury } from "../typechain";
import deploy from "../lib/deploy";

// Declare in global scope
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let charlie: SignerWithAddress;
let don: SignerWithAddress;
let probity: Probity, teller: Teller, treasury: Treasury;

describe("Custodian", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    probity = contracts.probity;
    teller = contracts.teller;
    treasury = contracts.treasury;

    // Set signers
    alice = signers.alice;
    bob = signers.bob;
    charlie = signers.charlie;
    don = signers.don;
  });

  describe("Vault Management", function () {
    describe("Opening a vault", function () {
      it("Opens a vault without equity", async () => {
        const coll = 150;
        const debt = 0;
        const equity = 0;

        // Create Alice's vault
        const tx = {
          from: alice.address,
          value: web3.utils.toWei(coll.toString()),
        };
        const txResponse = await probity
          .connect(alice)
          .openVault(debt, equity, tx);
        const result = await txResponse.wait();

        // Check Alice's equity balance in treasury
        const treasuryBalance = await treasury.balanceOf(alice.address);
        expect(treasuryBalance.toString()).to.equal("0");

        // Check Alice's vault details
        const vault = await probity.connect(alice).getVault();
        expect(vault[0]).to.equal(1);
        expect(web3.utils.fromWei(vault[1].toString())).to.equal(
          coll.toString()
        );

        // Check Alice's equity and debt balances
        expect(await treasury.balanceOf(alice.address)).to.equal(
          equity.toString()
        );
        expect(await teller.balanceOf(alice.address)).to.equal(debt.toString());
      });

      it("Opens a vault with equity", async () => {
        const coll = 150;
        const debt = 0;
        const equity = 100;

        // Create Bob's vault
        const tx = {
          from: bob.address,
          value: web3.utils.toWei(coll.toString()),
        };
        const txResponse = await probity
          .connect(bob)
          .openVault(debt, equity, tx);
        const result = await txResponse.wait();

        // Check Bob's equity balance in treasury
        const treasuryBalance = await treasury.balanceOf(bob.address);
        expect(treasuryBalance.toString()).to.equal("100");

        // Check Bob's vault details
        const vault = await probity.connect(bob).getVault();
        expect(vault[0]).to.equal(2);
        expect(web3.utils.fromWei(vault[1].toString())).to.equal(
          coll.toString()
        );

        // Check Bob's equity and debt balances
        expect(await treasury.balanceOf(bob.address)).to.equal(
          equity.toString()
        );
        expect(await teller.balanceOf(bob.address)).to.equal(debt.toString());

        // Ensure that used collateral is encumbered
        expect(web3.utils.fromWei(vault[2].toString())).to.equal(
          coll.toString()
        );
      });

      it("Opens a vault without collateral", async () => {
        const coll = 0;
        const debt = 0;
        const equity = 0;

        // Create Charlie's vault
        const tx = {
          from: charlie.address,
          value: web3.utils.toWei(coll.toString()),
        };
        const txResponse = await probity
          .connect(charlie)
          .openVault(debt, equity, tx);
        const result = await txResponse.wait();

        // Check Charlie's equity balance in treasury
        const treasuryBalance = await treasury.balanceOf(charlie.address);
        expect(treasuryBalance.toString()).to.equal("0");

        // Check Charlie's collateral
        const vault = await probity.connect(charlie).getVault();
        expect(vault[0]).to.equal(3);
        expect(web3.utils.fromWei(vault[1].toString())).to.equal(
          coll.toString()
        );

        // Check Charlie's equity and debt balances
        expect(await treasury.balanceOf(charlie.address)).to.equal(
          equity.toString()
        );
        expect(await teller.balanceOf(charlie.address)).to.equal(
          debt.toString()
        );
      });

      it("Fails to open if signer already has a vault", async () => {
        const coll = 0;
        const debt = 0;
        const equity = 0;

        // Attempt to create a second vault
        const tx = {
          from: charlie.address,
          value: web3.utils.toWei(coll.toString()),
        };
        await expect(
          probity.connect(charlie).openVault(debt, equity, tx)
        ).to.be.revertedWith("CUST: Vault already exists");
      });

      it("Fails to open with insufficient collateral", async () => {
        const coll = 0;
        const debt = 100;
        const equity = 100;
        const tx = {
          from: don.address,
          value: web3.utils.toWei(coll.toString()),
        };

        // Expect Don's vault to fail creation
        await expect(
          probity.connect(don).openVault(debt, equity, tx)
        ).to.be.revertedWith("PRO: Insufficient collateral provided");
      });
    });

    describe("Managing a vault", function () {
      it("Allows the user to add collateral", async () => {
        // Add 1000 collateral to Alice's vault (new total of 1150)
        const collateral = 1000;
        const equity = 0;
        const tx = {
          from: alice.address,
          value: web3.utils.toWei(collateral.toString()),
        };
        const txResponse = await probity
          .connect(alice)
          .addCollateral(equity, tx);
        const result = await txResponse.wait();

        // Check Alice's vault details
        const vault = await probity.connect(alice).getVault();
        expect(web3.utils.fromWei(vault[1].toString())).to.equal("1150");

        // Check that no collateral is encumbered
        expect(vault[2].toString()).to.equal("0");
      });

      it("Allows the user to withdraw equity", async () => {
        // TODO
      });

      it("Fails to close a non-empty vault", async () => {
        // TODO
      });

      it("Withdraws collateral from vault", async () => {
        // TODO
      });

      it("Fails to withdraw collateral from empty vault", async () => {
        // TODO
      });
    });

    describe("Closing a vault", function () {
      it("Fails to close a non-empty vault", async () => {
        // TODO
      });

      it("Closes an empty vault", async () => {
        // TODO
      });
    });
  });
});
