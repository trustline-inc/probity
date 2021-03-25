import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";

import { Exchange, Teller, Treasury, Vault } from "../typechain";

import deploy from "../lib/deploy";

// Wallets
let lender: SignerWithAddress;
let bootstrapper: SignerWithAddress;
let borrower: SignerWithAddress;

// Contracts
let exchange: Exchange;
let teller: Teller;
let treasury: Treasury;
let vault: Vault;

const SECONDS_IN_YEAR = 31536000;

describe("Treasury", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    exchange = contracts.exchange;
    teller = contracts.teller;
    treasury = contracts.treasury;
    vault = contracts.vault;

    // Set signers
    lender = signers.lender;
    bootstrapper = signers.bootstrapper;
    borrower = signers.borrower;
  });

  describe("Equity Management", async function () {
    it("Mints Aurei", async () => {
      // Set up initial collateral of 1,000 FLR
      const bootstrapperCollateral = 1000;

      const txBootstrapper = {
        from: bootstrapper.address,
        value: web3.utils.toWei(bootstrapperCollateral.toString()),
      };
      let txBootstrapperResponse = await vault
        .connect(bootstrapper)
        .deposit(txBootstrapper);

      // Issue 500 AUR from 1,000 FLR
      const aurei = 500;
      const encumberedCollateral = 1000;

      txBootstrapperResponse = await treasury
        .connect(bootstrapper)
        .issue(
          web3.utils.toWei(encumberedCollateral.toString()),
          web3.utils.toWei(aurei.toString())
        );
    });
  });
});
