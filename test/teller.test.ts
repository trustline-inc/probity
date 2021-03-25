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
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

const SECONDS_IN_YEAR = 31536000;

describe("Teller", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
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

      // Rate should equal 2% APR (RAY)
      expect(await teller.getRate()).to.equal(web3.utils.toWei("2000000000"));
    });
  });
});
