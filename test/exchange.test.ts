import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { network, web3 } from "hardhat";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Probity, Exchange, Teller } from "../typechain";

import deploy from "./helpers";

// Declare in global scope
let lender: SignerWithAddress, borrower: SignerWithAddress;
let exchange: Exchange, probity: Probity, teller: Teller;

describe("Exchange", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    exchange = contracts.exchange;
    probity = contracts.probity;
    teller = contracts.teller;

    // Set signers
    lender = signers.lender;
    borrower = signers.borrower;
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
      const rate = web3.utils.toWei(Math.pow(1.03, 1 / 31536000).toString()); //MPR
      const txLoanResponse = await exchange
        .connect(borrower)
        .executeOrder(lender.address, borrower.address, loanAmount, rate);
      const result = await txLoanResponse.wait();

      const variableRate = await exchange.getVariableRate();

      expect(variableRate).to.equal(rate);

      // Warp time by an hour
      await network.provider.send("evm_increaseTime", [3600]);

      // Check total debt
      // const txTellerResponse = await teller.connect(borrower).getTotalDebt();
    });
  });
});
