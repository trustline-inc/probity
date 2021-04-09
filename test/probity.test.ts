import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

import { Aurei, Teller, Treasury, Vault } from "../typechain";

import deploy from "../lib/deploy";

// Wallets
let lender: SignerWithAddress;
let bootstrapper: SignerWithAddress;
let borrower: SignerWithAddress;

// Contracts
let aurei: Aurei;
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

const SECONDS_IN_YEAR = 31536000;

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

    // Set up initial collateral of 2,000 FLR
    const bootstrapperCollateral = 2000;

    const txBootstrapper = {
      from: bootstrapper.address,
      value: web3.utils.toWei(bootstrapperCollateral.toString()),
    };
    let txBootstrapperResponse = await vault
      .connect(bootstrapper)
      .deposit(txBootstrapper);

    // Issue 1,000 AUR from 2,000 FLR
    const borrow = 1000;
    const encumberedCollateral = 2000;

    txBootstrapperResponse = await treasury
      .connect(bootstrapper)
      .issue(
        web3.utils.toWei(encumberedCollateral.toString()),
        web3.utils.toWei(borrow.toString())
      );
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

    it("Allows a user to borrow", async () => {
      // Create lender vault
      const lenderCollateral = 3000;

      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(lenderCollateral.toString()),
      };
      let txLenderResponse = await vault.connect(lender).deposit(txLender);

      // Issue equity
      const capital = 1000;
      txLenderResponse = await treasury
        .connect(lender)
        .issue(
          web3.utils.toWei(lenderCollateral.toString()),
          web3.utils.toWei(capital.toString())
        );

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
      borrowerCollateral = 3000;
      const txLoanResponse = await teller
        .connect(borrower)
        .createLoan(
          web3.utils.toWei(borrowerCollateral.toString()),
          web3.utils.toWei(principal.toString())
        );
      let result = await txLoanResponse.wait();

      // Capital balances
      const lenderCapital = await treasury.balanceOf(lender.address);
      expect(lenderCapital.toString()).to.equal(
        web3.utils.toWei(capital.toString())
      );

      const borrowerCapital = await treasury.balanceOf(lender.address);
      expect(borrowerCapital.toString()).to.equal("0");

      // Aurei balances
      const lenderAurei = await aurei.balanceOf(lender.address);
      expect(lenderAurei.toString()).to.equal("0");

      const borrowerAurei = await aurei.balanceOf(borrower.address);
      expect(borrowerAurei.toString()).to.equal(
        web3.utils.toWei(principal.toString())
      );

      // Debt balances
      const lenderDebt = await teller.balanceOf(lender.address);
      expect(lenderDebt.toString()).to.equal("0");

      const borrowerDebt = await teller.balanceOf(borrower.address);
      expect(borrowerDebt.toString()).to.equal(
        web3.utils.toWei(principal.toString())
      );
    });
  });
});
