import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import BigNumber from "bignumber.js";
import { Decimal } from "decimal.js";
import { ethers, web3 } from "hardhat";
import { expect } from "chai";

import { TcnToken, Teller, Treasury, Vault } from "../typechain";

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
  rounding: Decimal.ROUND_DOWN,
});

// Wallets
let lender: SignerWithAddress;
let bootstrapper: SignerWithAddress;
let borrower: SignerWithAddress;

// Contracts
let tcnToken: TcnToken;
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

describe("Treasury", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    tcnToken = contracts.tcnToken;
    teller = contracts.teller;
    treasury = contracts.treasury;
    vault = contracts.vault;

    // Set signers
    lender = signers.lender;
    bootstrapper = signers.bootstrapper;
    borrower = signers.borrower;
  });

  describe("Capital allocation", async function () {
    it("Mints Aurei", async () => {
      // Set up initial collateral of 1,000 FLR
      const lenderCollateral = 1000;

      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(lenderCollateral.toString()),
      };
      let txLenderResponse = await vault.connect(lender).deposit(txLender);

      // Issue 500 AUR from 1,000 FLR
      const aurei = 500;
      const encumberedCollateral = 1000;

      txLenderResponse = await treasury
        .connect(lender)
        .issue(
          web3.utils.toWei(encumberedCollateral.toString()),
          web3.utils.toWei(aurei.toString())
        );
    });

    it("Gets the current balance", async () => {
      let balance: any;

      balance = await treasury.capitalOf(bootstrapper.address);

      expect(web3.utils.fromWei(balance.toString())).to.equal("0");

      // Set up borrower vault
      const txBorrower = {
        from: borrower.address,
        value: web3.utils.toWei((1000).toString()),
      };
      await vault.connect(borrower).deposit(txBorrower);

      // Create loan
      const principal = 400;
      const collateral = 800;
      await teller
        .connect(borrower)
        .createLoan(
          web3.utils.toWei(collateral.toString()),
          web3.utils.toWei(principal.toString())
        );

      // 80% utilization and 5% APR
      const APR = await teller.getAPR();
      const utilization = new BigNumber(principal).div(500);
      const expectedAPR = new BigNumber(1).plus(
        new BigNumber(1).div(
          new BigNumber(100).multipliedBy(new BigNumber(1).minus(utilization))
        )
      );
      expect(new BigNumber(APR.toString()).div(1e27).toString()).to.equal(
        expectedAPR.toString()
      );

      Decimal.set({ precision: 30, rounding: Decimal.ROUND_DOWN }); // Extra level of precision required for rounding
      const expectedMPR = new Decimal(expectedAPR.toString()).toPower(
        new Decimal(1).div(SECONDS_IN_YEAR)
      );
      Decimal.set({ precision: 27, rounding: Decimal.ROUND_DOWN });

      var expectedMprAsInteger = new BigNumber(
        expectedMPR.toFixed(27)
      ).multipliedBy(1e27);

      const MPR = await teller.getMPR();
      const MPR_AS_DECIMAL = new BigNumber(MPR.toString()).div(1e27);
      const APR_AS_DECIMAL = new BigNumber(MPR_AS_DECIMAL).pow(SECONDS_IN_YEAR);

      expect(MPR.toString()).to.equal(expectedMprAsInteger.toString());
      expect(MPR_AS_DECIMAL.toString()).to.equal(expectedMPR.toFixed(27));
      expect(APR_AS_DECIMAL.toFixed(2)).to.equal(expectedAPR.toFixed(2));

      // Warp time
      await ethers.provider.send("evm_increaseTime", [SECONDS_IN_YEAR]);
      await ethers.provider.send("evm_mine", []);

      // Force rate accumulator to update with a second loan
      await teller
        .connect(borrower)
        .createLoan(
          web3.utils.toWei((20).toString()),
          web3.utils.toWei((10).toString())
        );

      // Check capital balance
      balance = await treasury.capitalOf(lender.address);
      const expectedLenderCapital = new BigNumber(expectedMPR.toString())
        .minus(1)
        .multipliedBy(utilization)
        .plus(1)
        .pow(SECONDS_IN_YEAR + 1)
        .multipliedBy(500)
        .multipliedBy(1e18)
        .decimalPlaces(0);

      // Fix this later
      // expect(web3.utils.fromWei(balance.toString())).to.equal(web3.utils.fromWei(expectedLenderCapital.toString()));
    });
  });

  describe("Interest", async function () {
    it("Allows interest withdrawal", async () => {
      var interest = await treasury.interestOf(lender.address);
      await treasury.connect(lender).withdraw(10, true);
      const balance = await tcnToken.balanceOf(lender.address);
      interest = await treasury.interestOf(lender.address);
      expect(
        parseFloat(web3.utils.fromWei(balance.toString()))
      ).to.be.greaterThan(0);
      const supply = await tcnToken.totalSupply();
      expect(supply).to.equal(balance);
    });
  });

  describe("Collateral Redemption", async function () {
    it("Redeems capital", async () => {
      const aureiSupplied = 400;
      const encumberedCollateral = 800;
      await expect(
        treasury
          .connect(lender)
          .redeem(
            web3.utils.toWei(encumberedCollateral.toString()),
            web3.utils.toWei(aureiSupplied.toString())
          )
      ).to.be.revertedWith("TREASURY: Not enough reserves.");
    });
  });
});
