import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import BigNumber from "bignumber.js";
import { Decimal } from "decimal.js";
import { web3 } from "hardhat";
import { expect } from "chai";

import { Aurei, Teller, Treasury, Vault } from "../typechain";

import deploy from "../lib/deploy";
import { SECONDS_IN_YEAR, RAY, WAD } from "./constants";

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

describe("Teller", function () {
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

    /**
     * Set up Aurei liquidity pool
     */
    const lenderCollateral = 4000; // FLR

    // Issue 2000 AUR from 4000 FLR (200% collateralization)
    const equity = 2000;

    await treasury.connect(lender).stake(web3.utils.toWei(equity.toString()), {
      value: web3.utils.toWei(lenderCollateral.toString()),
    });
  });

  describe("Loan Creation", async function () {
    it("Creates an Aurei loan", async () => {
      const collateral = 2000; // FLR
      const principal = 1000; // AUR

      // Create loan
      const txBorrowerResponse = await teller
        .connect(borrower)
        .createLoan(web3.utils.toWei(principal.toString()), {
          value: web3.utils.toWei(collateral.toString()),
        });

      var tx = await web3.eth.getTransaction(txBorrowerResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);
      lastUpdated = block.timestamp;

      // APR should equal 2% (1.02 * 1e27)
      const APR = await teller.getAPR();
      const utilization = new BigNumber(principal).div(2000);
      const expectedAPR = new BigNumber(1).plus(
        new BigNumber(1).div(
          new BigNumber(100).multipliedBy(new BigNumber(1).minus(utilization))
        )
      );
      expect(new BigNumber(APR.toString()).div(1e27).toString()).to.equal(
        expectedAPR.toString()
      );

      // MPR should equal (1.02 * 1e27)^(1/31557600)=1000000000627507392906712187
      const MPR = await teller.getMPR();
      const expectedMpr = "1000000000627507392906712187";
      expect(MPR.toString()).to.equal(expectedMpr);

      // MPR TO APR. There is a slight loss in precision, so results are fixed to 18 DPs.
      const APR_TO_DECIMAL = new BigNumber(APR.toString()).div(RAY);
      const MPR_TO_DECIMAL = new BigNumber(MPR.toString()).div(RAY);
      const MPR_TO_APR = MPR_TO_DECIMAL.pow(SECONDS_IN_YEAR).toFormat(
        18,
        BigNumber.ROUND_HALF_UP
      );

      expect(MPR_TO_APR).to.equal(
        APR_TO_DECIMAL.toFixed(18, BigNumber.ROUND_HALF_UP)
      );

      const balance = web3.utils.fromWei(
        (await teller.balanceOf(borrower.address)).toString()
      );
      expect(balance).to.equal("1000");
    });

    it("Allows users to repay debt", async () => {
      const principal = 1000; // AUR
      const repayment = 500; // AUR
      const collateral = 1000; // FLR

      // Approve Aurei transfer to treasury
      await aurei
        .connect(borrower)
        .approve(teller.address, web3.utils.toWei(repayment.toString()));

      // MPR before repayment
      const MPR_PRIOR = await teller.getMPR();
      const MPR_PRIOR_AS_DECIMAL = new BigNumber(MPR_PRIOR.toString()).div(RAY);

      expect(MPR_PRIOR.toString()).to.equal("1000000000627507392906712187");

      // Make a repayment
      const txLoanResponse = await teller
        .connect(borrower)
        .repay(
          web3.utils.toWei(repayment.toString()),
          web3.utils.toWei(collateral.toString())
        );

      var tx = await web3.eth.getTransaction(txLoanResponse.hash);
      var block = await web3.eth.getBlock(tx.blockNumber);
      var timestamp = block.timestamp;

      var delta = Number(timestamp) - lastUpdated;

      // APR & MPR after repayment
      const APR_AFTER = await teller.getAPR();
      const MPR_AFTER = await teller.getMPR();

      expect(MPR_AFTER.toString()).to.equal("1000000000471791660242312990");

      // MPR TO APR
      const APR_TO_DECIMAL = new BigNumber(APR_AFTER.toString()).div(RAY);
      const MPR_AFTER_AS_DECIMAL = new BigNumber(MPR_AFTER.toString()).div(RAY);
      const MPR_TO_APR = MPR_AFTER_AS_DECIMAL.pow(SECONDS_IN_YEAR);
      expect(MPR_TO_APR.toFixed(3, BigNumber.ROUND_HALF_UP)).to.equal(
        APR_TO_DECIMAL.toFixed(3)
      );

      // Check balance and interest due
      const balance = await teller.balanceOf(borrower.address);
      const interest = new BigNumber(balance.toString()).minus(
        web3.utils.toWei(repayment.toString())
      );
      const cumulativeRate = MPR_PRIOR_AS_DECIMAL.pow(delta).toFixed(27);
      const expectedBalance = new BigNumber(cumulativeRate)
        .multipliedBy(new BigNumber(principal).minus(repayment))
        .toFixed(18, BigNumber.ROUND_UP);
      const expectedInterest = new BigNumber(expectedBalance).minus(500);

      expect(web3.utils.fromWei(balance.toString())).to.equal(
        expectedBalance.toString()
      );
      expect(web3.utils.fromWei(interest.toString())).to.equal(
        expectedInterest.toString()
      );
    });

    it("Gets the utilization rate", async () => {
      const utilization = await teller.getUtilization();
      expect(utilization).to.have.lengthOf(3);
    });
  });
});
