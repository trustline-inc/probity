import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

import { contracts, deploy, signers } from "./helpers";

const { lender, borrower } = signers;
const { exchange, probity } = contracts;

describe("Custodian", function () {
  before(async function () {
    await deploy();
  });

  describe("Interest Rates", async function () {
    it("it updates when a loan is created", async () => {
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

      // Creating Borrower's vault
      const txBorrower = {
        from: borrower.address,
        value: web3.utils.toWei(coll.toString()),
      };
      const txBorrowerResponse = await probity
        .connect(borrower)
        .openVault(initialDebt, initialEquity, txBorrower);

      // Match borrower with lender's equity to generate loan.
      const loanAmount = 50;
      const rate = 3;
      const txLoanResponse = await exchange
        .connect(borrower)
        .executeOrder(lender.address, borrower.address, loanAmount, rate);
      const result = await txLoanResponse.wait();

      const variableRate = await exchange.getVariableRate();

      expect(variableRate).to.equal(rate);
    });
  });
});
