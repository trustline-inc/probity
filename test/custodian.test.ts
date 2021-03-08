import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

import { contracts, deploy, signers } from "./helpers";

const { alice, bob, charlie, don } = signers;
const { probity, teller, treasury } = contracts;

describe("Custodian", function () {
  before(async function () {
    await deploy();
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
