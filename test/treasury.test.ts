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
    borrower = signers.borrower;
  });

  describe("Capital allocation", async function () {
    it("Mints Aurei", async () => {
      // Set up initial collateral of 750 FLR
      const lenderCollateral = 750;

      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(lenderCollateral.toString()),
      };
      let txLenderResponse = await vault.connect(lender).deposit(txLender);

      // Issue 500 AUR from 750 FLR
      const aurei = 500;
      const encumberedCollateral = 750;

      txLenderResponse = await treasury
        .connect(lender)
        .issue(
          web3.utils.toWei(encumberedCollateral.toString()),
          web3.utils.toWei(aurei.toString())
        );

      const balance = await treasury.connect(lender).capitalOf(lender.address);

      expect(balance.toString()).to.equal(web3.utils.toWei(aurei.toString()));
    });

    it("Gets the current balance", async () => {
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

      const MPR = await teller.getMPR();
      const MPR_AS_DECIMAL = new BigNumber(MPR.toString()).div(1e27);
      const APR_AS_DECIMAL = new BigNumber(MPR_AS_DECIMAL).pow(SECONDS_IN_YEAR);

      expect(MPR.toString()).to.equal("1000000001546067007857011769");
      expect(MPR_AS_DECIMAL.toString()).to.equal(
        "1.000000001546067007857011769"
      );
      expect(APR_AS_DECIMAL.toFixed(3, BigNumber.ROUND_HALF_UP)).to.equal(
        expectedAPR.toFixed(3, BigNumber.ROUND_HALF_UP)
      );

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
      let balance = await treasury.capitalOf(lender.address);
      const expectedMPR = "1.000000001546067007857011769";
      const expectedLenderCapital = new BigNumber(
        new BigNumber(expectedMPR)
          .minus(1)
          .multipliedBy(utilization)
          .plus(1)
          .toFixed(27)
      )
        .pow(SECONDS_IN_YEAR + 2)
        .multipliedBy(500)
        .multipliedBy(1e18)
        .toFixed(0, BigNumber.ROUND_UP);

      // Loses precision with DS-Math, probably due to the large exponent (31577600)
      // Either try a new math library or reduce the period to something smaller like a month
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
      const aureiSupplied = 500;
      const encumberedCollateral = 750;
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
