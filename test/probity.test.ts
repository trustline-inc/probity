import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Aurei, Exchange, Probity, Teller } from "../typechain";
import deploy from "../lib/deploy";

// Declare in global scope
let lender: SignerWithAddress, borrower: SignerWithAddress;
let aurei: Aurei, exchange: Exchange, probity: Probity, teller: Teller;

describe("Probity", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    aurei = contracts.aurei;
    exchange = contracts.exchange;
    probity = contracts.probity;
    teller = contracts.teller;

    // Set signers
    lender = signers.lender;
    borrower = signers.borrower;

    /**
     * VAULT SETUP
     */

    const initialCollateral = 0;
    const initialDebt = 0;
    const initialEquity = 0;

    // Create Lender's vault
    const txLender = {
      from: lender.address,
      value: web3.utils.toWei(initialCollateral.toString()),
    };
    const txResponse = await probity
      .connect(lender)
      .openVault(initialDebt, initialEquity, txLender);

    // Creating Borrower's vault
    const txBorrower = {
      from: borrower.address,
      value: web3.utils.toWei(initialCollateral.toString()),
    };
    const txBorrowerResponse = await probity
      .connect(borrower)
      .openVault(initialDebt, initialEquity, txBorrower);
  });

  describe("Lending", function () {
    it("Fails to create loan without collateral from borrower", async () => {
      const loanAmount = 50;
      const rate = 3;
      await expect(
        exchange
          .connect(borrower)
          .executeOrder(
            lender.address,
            borrower.address,
            web3.utils.toWei(loanAmount.toString()),
            rate
          )
      ).to.be.revertedWith("PRO: Insufficient collateral provided");
    });

    it("Fails to create loan without equity from lender", async () => {
      const collateral = 1000;
      const initialDebt = 0;
      const initialEquity = 0;

      // Add collateral to lender's vault
      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(collateral.toString()),
      };
      const txLenderResponse = await probity
        .connect(lender)
        .addCollateral(initialEquity, txLender);

      // Assert collateral was added
      const lenderVault = await probity.connect(lender).getVault();
      expect(web3.utils.fromWei(lenderVault[1].toString())).to.equal(
        collateral.toString()
      );

      // Add collateral to borrower's vault
      const txBorrower = {
        from: borrower.address,
        value: web3.utils.toWei(collateral.toString()),
      };
      const txBorrowerResponse = await probity
        .connect(borrower)
        .addCollateral(initialEquity, txBorrower);

      // Assert collateral was added
      const borrowerVault = await probity.connect(lender).getVault();
      expect(web3.utils.fromWei(borrowerVault[1].toString())).to.equal(
        collateral.toString()
      );

      const loanAmount = 50;
      const rate = 3;
      await expect(
        exchange.executeOrder(
          lender.address,
          borrower.address,
          web3.utils.toWei(loanAmount.toString()),
          web3.utils.toWei(rate.toString())
        )
      ).to.be.revertedWith("TREASURY: Insufficient balance.");
    });

    it("Creates a loan with sufficient lender equity and borrower collateral", async () => {
      // Create equity on lender vault
      const encumber = 200;
      const equity = 100;

      const txLenderResponse = await probity
        .connect(lender)
        .increaseEquity(
          web3.utils.toWei(encumber.toString()),
          web3.utils.toWei(equity.toString())
        );

      // Match borrower with lender's equity to generate loan.
      const loanAmount = 50;
      const rate = 3;
      const txLoanResponse = await exchange.executeOrder(
        lender.address,
        borrower.address,
        web3.utils.toWei(loanAmount.toString()),
        web3.utils.toWei(rate.toString())
      );
      const result = await txLoanResponse.wait();

      // LoanCreated event was emitted
      expect(result.events.length).to.equal(3);

      // Borrower loan balance changed
      expect(await teller.balanceOf(borrower.address)).to.equal(
        web3.utils.toWei(loanAmount.toString())
      );

      // Borrower Aurei balance changed
      expect(await aurei.balanceOf(borrower.address)).to.equal(
        web3.utils.toWei(loanAmount.toString())
      );
    });
  });
});
