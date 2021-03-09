import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Aurei, Exchange, Probity, Teller } from "../typechain";
import deploy from "./helpers";

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
      const initialCollateral = 1000;
      const initialDebt = 0;
      const initialEquity = 0;

      // Creating Borrower's vault
      const txBorrower = {
        from: borrower.address,
        value: web3.utils.toWei(initialCollateral.toString()),
      };
      const txBorrowerResponse = await probity
        .connect(borrower)
        .openVault(initialDebt, initialEquity, txBorrower);

      const loanAmount = 50;
      const rate = 3;
      await expect(
        exchange.executeOrder(
          lender.address,
          borrower.address,
          web3.utils.toWei(loanAmount.toString()),
          rate
        )
      ).to.be.revertedWith("TREASURY: Insufficient balance.");
    });

    it("Creates a loan with sufficient lender equity and borrower collateral", async () => {
      // Create equity on lender vault
      const initialDebt = 0;
      const initialEquity = 1000;
      const coll = 3000;

      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(coll.toString()),
      };
      const txLenderResponse = await probity
        .connect(lender)
        .openVault(initialDebt, initialEquity, txLender);

      // Match borrower with lender's equity to generate loan.
      const loanAmount = 50;
      const rate = 3;
      const txLoanResponse = await exchange.executeOrder(
        lender.address,
        borrower.address,
        web3.utils.toWei(loanAmount.toString()),
        rate
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
