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
  POW_PRECISION: 30,
  DECIMAL_PLACES: 27,
  EXPONENTIAL_AT: 1e9,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
});
Decimal.config({
  precision: 30,
  toExpPos: 28,
  toExpNeg: -28,
  rounding: Decimal.ROUND_DOWN,
});

// Wallets
let lender: SignerWithAddress;
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
    borrower = signers.borrower;
  });

  describe("Rates", async function () {
    it("Allows a user to borrow", async () => {
      // Create lender vault
      const lenderCollateral = 5000;

      // Mint 1500 Aurei
      const capital = 1500;
      const txLenderResponse = await treasury
        .connect(lender)
        .stake(web3.utils.toWei(capital.toString()), {
          value: web3.utils.toWei(lenderCollateral.toString()),
        });
      var tx = await web3.eth.getTransaction(txLenderResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);

      // Verify the rate
      let utilization = new BigNumber(0).div(capital);
      let expectedAPR = new BigNumber(1).plus(
        new BigNumber(1).div(
          new BigNumber(100).multipliedBy(new BigNumber(1).minus(utilization))
        )
      );
      let expectedMPR = new Decimal(expectedAPR.toString())
        .pow(new Decimal(1).div(SECONDS_IN_YEAR))
        .toFixed(27);

      let expectedMprAsInteger = new BigNumber(expectedMPR).multipliedBy(1e27);
      let MPR = await teller.getMPR();
      let MPR_AS_DECIMAL = new BigNumber(MPR.toString()).div(1e27).toFixed(27);
      let APR_AS_DECIMAL = new BigNumber(MPR_AS_DECIMAL).pow(SECONDS_IN_YEAR);

      expect(MPR.toString()).to.equal(expectedMprAsInteger.toString());
      expect(MPR_AS_DECIMAL.toString()).to.equal(expectedMPR.toString());
      expect(APR_AS_DECIMAL.toFixed(3, BigNumber.ROUND_HALF_UP)).to.equal(
        expectedAPR.toFixed(3, BigNumber.ROUND_HALF_UP)
      );

      // Create borrower vault
      let borrowerCollateral = 3000;

      // Borrow 500 Aurei
      const principal = 500;
      borrowerCollateral = 1000;
      const txBorrowerResponse = await teller
        .connect(borrower)
        .createLoan(web3.utils.toWei(principal.toString()), {
          value: web3.utils.toWei(borrowerCollateral.toString()),
        });
      var tx = await web3.eth.getTransaction(txBorrowerResponse.hash);
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
      utilization = new BigNumber(principal).div(capital);
      expectedAPR = new BigNumber(1).plus(
        new BigNumber(1).div(
          new BigNumber(100).multipliedBy(new BigNumber(1).minus(utilization))
        )
      );

      expectedMPR = new Decimal(expectedAPR.toString())
        .pow(new Decimal(1).div(SECONDS_IN_YEAR))
        .toFixed(27);

      expectedMprAsInteger = new BigNumber(expectedMPR).multipliedBy(1e27);
      MPR = await teller.getMPR();
      MPR_AS_DECIMAL = new BigNumber(MPR.toString()).div(1e27).toFixed(27);
      APR_AS_DECIMAL = new BigNumber(MPR_AS_DECIMAL).pow(SECONDS_IN_YEAR);

      expect(MPR.toString()).to.equal(expectedMprAsInteger.toString());
      expect(MPR_AS_DECIMAL.toString()).to.equal(expectedMPR.toString());
      expect(APR_AS_DECIMAL.toFixed(3, BigNumber.ROUND_HALF_UP)).to.equal(
        expectedAPR.toFixed(3, BigNumber.ROUND_HALF_UP)
      );
    });

    it("Allows a user to borrow a second time", async () => {
      // Borrow Aurei a second time
      const principal = 500;
      const borrowerCollateral = 1000;

      // Get MPR before the borrow
      const expectedAPR = 1.015;
      const expectedUtilization = 1 / 3;

      Decimal.set({ precision: 30, rounding: Decimal.ROUND_DOWN }); // Extra level of precision required for rounding
      const expectedMPR = new Decimal(expectedAPR)
        .toPower(new Decimal(1).div(SECONDS_IN_YEAR))
        .pow(1)
        .toFixed(27);
      Decimal.set({ precision: 27, rounding: Decimal.ROUND_DOWN });

      const expectedMprAsInteger = new BigNumber(expectedMPR).multipliedBy(
        1e27
      );
      const MPR = await teller.getMPR();
      expect(MPR.toString()).to.equal(expectedMprAsInteger.toString());

      // Borrow 500 Aurei
      const txLoanResponse = await teller
        .connect(borrower)
        .createLoan(web3.utils.toWei(principal.toString()), {
          value: web3.utils.toWei(borrowerCollateral.toString()),
        });
      var tx = await web3.eth.getTransaction(txLoanResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);
      var timestamp = block.timestamp;

      var delta = Number(timestamp) - lastUpdated + 1;

      // Check capital balances
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
        .minus(1)
        .multipliedBy(delta)
        .plus(1)
        .multipliedBy(principal)
        .plus(principal)
        .multipliedBy(1e18)
        .decimalPlaces(0);
      const borrowerDebt = await teller.balanceOf(borrower.address);
      expect(borrowerDebt.toString()).to.equal(expectedBorrowerDebt.toString());
    });
  });
});
