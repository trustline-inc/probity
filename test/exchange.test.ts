import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, network, web3 } from "hardhat";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Probity, Exchange, Teller } from "../typechain";

import deploy from "../lib/deploy";

// Declare in global scope
let lender: SignerWithAddress, borrower: SignerWithAddress;
let exchange: Exchange, probity: Probity, teller: Teller;

const SECONDS_IN_YEAR = 31536000;

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

  describe("Rates", async function () {
    it("Uses the right unit system", async () => {
      // Convert to MPR by taking the n-th root
      const APR = 1.03; // 3%
      const MPR = Math.pow(APR, 1 / SECONDS_IN_YEAR);
      expect(MPR).to.equal(1.0000000009373036);
      expect(Math.pow(MPR, SECONDS_IN_YEAR).toFixed(2)).to.equal(
        APR.toString()
      );

      // Calculations in Wei
      expect(web3.utils.toWei(MPR.toString()).length).to.equal(19); // e.g., 1e18
      expect(web3.utils.toWei(MPR.toString())).to.equal("1000000000937303600");
    });

    it("Sets the vault's normalized debt", async () => {
      // TODO
    });

    it("Updates the cumulative rate", async () => {
      // TODO
    });

    it("Compounds continuously", async () => {
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
        .openVault(
          initialDebt,
          web3.utils.toWei(initialEquity.toString()),
          txLender
        );

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
      const rate = Math.pow(1.03, 1 / SECONDS_IN_YEAR); // MPR
      const txLoanResponse = await exchange
        .connect(borrower)
        .executeOrder(
          lender.address,
          borrower.address,
          web3.utils.toWei(loanAmount.toString()),
          web3.utils.toWei(rate.toString())
        );
      let result = await txLoanResponse.wait();

      const variableRate = await exchange.getVariableRate();

      expect(web3.utils.fromWei(variableRate.toString())).to.equal(
        rate.toString()
      );

      // Warp time by an hour
      await network.provider.send("evm_increaseTime", [3600]);
      await network.provider.send("evm_mine");

      const expectedRate = Math.exp((rate - 1) * 3600);
      const expectedInterest = loanAmount * expectedRate - loanAmount;
      const expectedDebt = loanAmount + expectedInterest;

      // Check total debt. Precision limited by native JavaScript Math
      const txTellerResponse = await teller.connect(borrower).getTotalDebt();

      expect(
        web3.utils
          .fromWei(
            txTellerResponse
              .div(ethers.utils.parseUnits("1", 18).toString())
              .toString()
          )
          .slice(0, 8)
      ).to.equal(expectedDebt.toString().slice(0, 8));
    });
  });
});
