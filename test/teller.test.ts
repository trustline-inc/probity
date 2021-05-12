import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import BigNumber from "bignumber.js";
import { Decimal } from "decimal.js";
import { web3 } from "hardhat";
import { expect } from "chai";

import { Aurei, Teller, Treasury, Vault } from "../typechain";

import deploy from "../lib/deploy";
import { SECONDS_IN_YEAR } from "./constants";

BigNumber.config({ POW_PRECISION: 27, DECIMAL_PLACES: 27 });
Decimal.config({ precision: 28, toExpPos: 28, rounding: Decimal.ROUND_FLOOR });
const RAY = new BigNumber("1e27");
const WAD = new BigNumber("1e18");

// Wallets
let lender: SignerWithAddress;
let bootstrapper: SignerWithAddress;
let borrower: SignerWithAddress;

// Contracts
let aurei: Aurei;
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

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
    bootstrapper = signers.bootstrapper;
    borrower = signers.borrower;

    /**
     * Set up Aurei liquidity pool
     */
    const bootstrapperCollateral = 4000; // FLR

    const txBootstrapper = {
      from: bootstrapper.address,
      value: web3.utils.toWei(bootstrapperCollateral.toString()),
    };
    let txBootstrapperResponse = await vault
      .connect(bootstrapper)
      .deposit(txBootstrapper);

    // Issue 2000 AUR from 4000 FLR (200% collateralization)
    const equity = 2000;
    const encumberedCollateral = 4000;

    txBootstrapperResponse = await treasury
      .connect(bootstrapper)
      .issue(
        web3.utils.toWei(encumberedCollateral.toString()),
        web3.utils.toWei(equity.toString())
      );
  });

  describe("Loan Creation", async function () {
    it("Creates an Aurei loan", async () => {
      const collateral = 2000; // FLR
      const principal = 1000; // AUR

      // Deposit collateral in vault
      await vault.connect(lender).deposit({
        value: web3.utils.toWei(collateral.toString()),
      });

      // Create loan
      await teller
        .connect(lender)
        .createLoan(
          web3.utils.toWei(collateral.toString()),
          web3.utils.toWei(principal.toString())
        );

      // APR should equal 2% (1.02 * 1e27)
      const APR = await teller.getAPR();
      expect(APR).to.equal("1020000000000000000000000000");

      // MPR should equal (1.02 * 1e27)^(1/31557600)=1000000000627507392906712187
      const MPR = await teller.getMPR();
      const expected = new Decimal(1.02)
        .toPower(new Decimal(1).div(SECONDS_IN_YEAR))
        .mul("1e27");
      expect(MPR.toString()).to.equal(expected.toString());

      // MPR TO APR (precision of 18 decimal digits is good enough)
      const APR_TO_DECIMAL = new BigNumber(APR.toString()).div(RAY).toFixed(18);
      const MPR_TO_DECIMAL = new BigNumber(MPR.toString()).div(RAY);
      const MPR_TO_APR = MPR_TO_DECIMAL.pow(SECONDS_IN_YEAR).toFormat(18);

      expect(MPR_TO_APR.toString()).to.equal(APR_TO_DECIMAL);

      const balance = web3.utils.fromWei(
        (await teller.balanceOf(lender.address)).toString()
      );
      expect(balance).to.equal("1000");
    });

    it("Allows users to repay debt", async () => {
      const principal = 1000; // AUR
      const repayment = 500; // AUR
      const collateral = 1000; // FLR

      // Allow Probity to transfer Aurei balance to treasury
      await aurei
        .connect(lender)
        .approve(teller.address, web3.utils.toWei(repayment.toString()));

      // MPR before repayment
      const MPR_PRIOR = await teller.getMPR();
      const MPR_PRIOR_AS_DECIMAL = new BigNumber(MPR_PRIOR.toString()).div(RAY);

      // Make a repayment
      await teller
        .connect(lender)
        .repay(
          web3.utils.toWei(repayment.toString()),
          web3.utils.toWei(collateral.toString())
        );

      // APR & MPR after repayment
      const APR_AFTER = await teller.getAPR();
      const MPR_AFTER = await teller.getMPR();

      // MPR TO APR (precision of 18 decimal digits is good enough)
      const APR_TO_DECIMAL = new BigNumber(APR_AFTER.toString())
        .div(RAY)
        .toFixed(18);
      const MPR_AFTER_AS_DECIMAL = new BigNumber(MPR_AFTER.toString()).div(RAY);
      const MPR_TO_APR = MPR_AFTER_AS_DECIMAL.pow(SECONDS_IN_YEAR).toFormat(18);
      expect(MPR_TO_APR.toString()).to.equal(APR_TO_DECIMAL.toString());

      // Check balance and interest due
      const balance = await teller.balanceOf(lender.address);
      const interest = new BigNumber(balance.toString()).minus(
        web3.utils.toWei(repayment.toString())
      );
      const cumulativeRate = MPR_PRIOR_AS_DECIMAL.multipliedBy(
        MPR_PRIOR_AS_DECIMAL
      );
      const cumulativeRateTimesPrincipal = cumulativeRate.multipliedBy(
        principal
      );
      const expectedBalance = cumulativeRateTimesPrincipal
        .minus(repayment)
        .toFixed(18);
      const expectedInterest = new BigNumber(expectedBalance).minus(500);
      expect(new BigNumber(balance.toString()).div(WAD).toString()).to.equal(
        expectedBalance.toString()
      );
      expect(new BigNumber(interest.toString()).div(WAD).toString()).to.equal(
        expectedInterest.toString()
      );
    });

    it("Fails repayment when collateral would dip below minimum ratio", async () => {
      // TODO
    });
  });

  describe("Loan Repayment", async function () {});
});
