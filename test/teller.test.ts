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

const rayToWad = (ray) => {
  return ray.div("1000000000");
};

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

    // Set up initial collateral of 4,000 FLR
    const bootstrapperCollateral = 4000;

    const txBootstrapper = {
      from: bootstrapper.address,
      value: web3.utils.toWei(bootstrapperCollateral.toString()),
    };
    let txBootstrapperResponse = await vault
      .connect(bootstrapper)
      .deposit(txBootstrapper);

    // Issue 2,000 AUR from 4,000 FLR
    const equity = 2000;
    const encumberedCollateral = 4000;

    txBootstrapperResponse = await treasury
      .connect(bootstrapper)
      .issue(
        web3.utils.toWei(encumberedCollateral.toString()),
        web3.utils.toWei(equity.toString())
      );
  });

  describe("Loans", async function () {
    it("Creates an Aurei loan", async () => {
      const collateral = 2000;
      const principal = 1000;

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

      // Rate should equal 2% APR
      expect(rayToWad(await teller.getRate())).to.equal(web3.utils.toWei("2"));

      const balance = web3.utils.fromWei(
        (await teller.balanceOf(lender.address)).toString()
      );
      expect(balance).to.equal("1000");
    });

    it("Allows users to repay debt", async () => {
      const repayment = 500;
      const collateral = 1000;

      // Allow Probity to transfer Aurei balance to treasury
      await aurei
        .connect(lender)
        .approve(teller.address, web3.utils.toWei(repayment.toString()));

      // Get rate at which interest was accumulating
      const rate = await teller.getRate();

      // Make a repayment
      await teller
        .connect(lender)
        .repay(
          web3.utils.toWei(repayment.toString()),
          web3.utils.toWei(collateral.toString())
        );

      // Calculate interest accrued (~14 periods of compounding interest)
      // 1000 * e^((1.000000031709791983764586504)*(14/31536000)) = 500.000443937179274209

      // Check balance
      const balance = web3.utils.fromWei(
        (await teller.balanceOf(lender.address)).toString()
      );
      expect(balance).to.equal("500.000443937179274209");
    });

    it("Fails repayment when collateral would dip below minimum ratio", async () => {
      // TODO
    });
  });
});
