import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";
import { Decimal } from "decimal.js";
import BigNumber from "bignumber.js";

import { Aurei, Teller, Treasury, Vault } from "../typechain";
import deploy from "../lib/deploy";
import { SECONDS_IN_YEAR } from "./constants";

BigNumber.config({
  POW_PRECISION: 27,
  DECIMAL_PLACES: 27,
  EXPONENTIAL_AT: 1e9,
});
Decimal.config({
  precision: 30,
  toExpPos: 28,
  toExpNeg: -28,
  rounding: Decimal.ROUND_HALF_UP,
});

// Wallets
let lender: SignerWithAddress;
let bootstrapper: SignerWithAddress;
let borrower: SignerWithAddress;

// Contracts
let aurei: Aurei;
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

// Global timestamp variable
var lastUpdated;

describe("Probity", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    vault = contracts.vault;

    // Set signers
    lender = signers.lender;
    bootstrapper = signers.bootstrapper;
    borrower = signers.borrower;
  });

  describe("Rates", async function () {
    it("Uses the right unit system", async () => {
      // Convert to MPR by taking the n-th root
      const APR = 1.03; // 3%
      const MPR = Math.pow(APR, 1 / SECONDS_IN_YEAR);
      expect(MPR).to.equal(1.0000000009366619);
      expect(Math.pow(MPR, SECONDS_IN_YEAR).toFixed(2)).to.equal(
        APR.toString()
      );

      // Calculations in Wei
      expect(web3.utils.toWei(MPR.toString()).length).to.equal(19); // e.g., 1e18
      expect(web3.utils.toWei(MPR.toString())).to.equal("1000000000936661900");
    });

    it("Sets the vault's normalized debt", async () => {
      // TODO
    });

    it("Updates the cumulative rate", async () => {
      // TODO
    });

    it("Allows a user to borrow", async () => {
      // Create lender vault
      const lenderCollateral = 5000;

      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(lenderCollateral.toString()),
      };
      let txLenderResponse = await vault.connect(lender).deposit(txLender);

      // Issue equity
      const capital = 1500;
      txLenderResponse = await treasury
        .connect(lender)
        .issue(
          web3.utils.toWei(lenderCollateral.toString()),
          web3.utils.toWei(capital.toString())
        );
      var tx = await web3.eth.getTransaction(txLenderResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);

      // Creating borrower vault
      let borrowerCollateral = 3000;

      const txBorrower = {
        from: borrower.address,
        value: web3.utils.toWei(borrowerCollateral.toString()),
      };
      const txBorrowerResponse = await vault
        .connect(borrower)
        .deposit(txBorrower);

      // Borrow Aurei
      const principal = 500;
      borrowerCollateral = 1000;
      const txLoanResponse = await teller
        .connect(borrower)
        .createLoan(
          web3.utils.toWei(borrowerCollateral.toString()),
          web3.utils.toWei(principal.toString())
        );
      let result = await txLoanResponse.wait();
      var tx = await web3.eth.getTransaction(txLenderResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);
      lastUpdated = block.timestamp;

      // Check capital balances
      var lenderCapital = await treasury.capitalOf(lender.address);
      expect(lenderCapital.toString()).to.equal("1500000000000000000000");

      const borrowerCapital = await treasury.capitalOf(borrower.address);
      expect(borrowerCapital.toString()).to.equal("0");

      // Check aurei balances
      const lenderAurei = await aurei.balanceOf(lender.address);
      expect(lenderAurei.toString()).to.equal("0");

      const borrowerAurei = await aurei.balanceOf(borrower.address);
      expect(borrowerAurei.toString()).to.equal(
        web3.utils.toWei(principal.toString())
      );

      // Check debt balances
      const lenderDebt = await teller.balanceOf(lender.address);
      expect(lenderDebt.toString()).to.equal("0");

      const borrowerDebt = await teller.balanceOf(borrower.address);
      expect(borrowerDebt.toString()).to.equal(
        web3.utils.toWei(principal.toString())
      );

      // Verify the rate
      const utilization = new BigNumber(principal).div(capital);
      const expectedAPR = new BigNumber(1).plus(
        new BigNumber(1).div(
          new BigNumber(100).multipliedBy(new BigNumber(1).minus(utilization))
        )
      );

      Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP }); // Extra level of precision required for rounding
      const expectedMPR = new Decimal(expectedAPR.toString())
        .pow(new Decimal(1).div(SECONDS_IN_YEAR))
        .toFixed(27);
      Decimal.set({ precision: 27, rounding: Decimal.ROUND_HALF_UP });

      const expectedMprAsInteger = new BigNumber(expectedMPR).multipliedBy(
        1e27
      );
      const MPR = await teller.getMPR();
      const MPR_AS_DECIMAL = new BigNumber(MPR.toString())
        .div(1e27)
        .toFixed(27);
      const APR_AS_DECIMAL = new BigNumber(MPR_AS_DECIMAL).pow(SECONDS_IN_YEAR);

      expect(MPR.toString()).to.equal(expectedMprAsInteger.toString());
      expect(MPR_AS_DECIMAL.toString()).to.equal(expectedMPR.toString());
      expect(APR_AS_DECIMAL.toFixed(3)).to.equal(expectedAPR.toString());
    });

    it("Allows a user to borrow a second time", async () => {
      // Borrow Aurei a second time
      const principal = 500;
      const borrowerCollateral = 1000;
      const txLoanResponse = await teller
        .connect(borrower)
        .createLoan(
          web3.utils.toWei(borrowerCollateral.toString()),
          web3.utils.toWei(principal.toString())
        );
      let result = await txLoanResponse.wait();
      var tx = await web3.eth.getTransaction(txLoanResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);
      var timestamp = block.timestamp;
      // var delta = Number(timestamp) - lastUpdated;
      var delta = 1;

      // Check capital balances
      const expectedAPR = 1.015;
      const expectedUtilization = 1 / 3;
      const expectedMPR = new Decimal(expectedAPR)
        .toPower(new Decimal(1).div(SECONDS_IN_YEAR))
        .pow(delta);
      const expectedLenderCapital = new BigNumber(expectedMPR.toString())
        .minus(1)
        .multipliedBy(expectedUtilization)
        .plus(1)
        .multipliedBy(1500)
        .multipliedBy(1e18)
        .decimalPlaces(0);
      var lenderCapital = await treasury.capitalOf(lender.address);
      expect(lenderCapital.toString()).to.equal(
        expectedLenderCapital.toString()
      );

      const borrowerCapital = await treasury.capitalOf(borrower.address);
      expect(borrowerCapital.toString()).to.equal("0");

      // Check aurei balances
      const lenderAurei = await aurei.balanceOf(lender.address);
      expect(lenderAurei.toString()).to.equal("0");

      const expectedBorrowerAurei = "1000000000000000000000";
      const borrowerAurei = await aurei.balanceOf(borrower.address);
      expect(borrowerAurei.toString()).to.equal(expectedBorrowerAurei);

      // Check debt balances
      const lenderDebt = await teller.balanceOf(lender.address);
      expect(lenderDebt.toString()).to.equal("0");

      const expectedBorrowerDebt = new BigNumber(expectedMPR.toString())
        .multipliedBy(principal)
        .plus(principal)
        .multipliedBy(1e18)
        .decimalPlaces(0);
      const borrowerDebt = await teller.balanceOf(borrower.address);
      expect(borrowerDebt.toString()).to.equal(expectedBorrowerDebt.toString());
    });
  });
});
