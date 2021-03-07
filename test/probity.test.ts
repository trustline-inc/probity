import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, web3 } from "hardhat";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

// Import contract factory types
import {
  AureiFactory,
  CustodianFactory,
  ProbityFactory,
  RegistryFactory,
  TellerFactory,
  TreasuryFactory,
  ExchangeFactory,
} from "../typechain";

// Import contract types
import {
  Aurei,
  Custodian,
  Probity,
  Registry,
  Teller,
  Treasury,
  Exchange,
} from "../typechain";

describe("Probity", function () {
  // Contracts
  let aurei: Aurei;
  let custodian: Custodian;
  let exchange: Exchange;
  let probity: Probity;
  let registry: Registry;
  let teller: Teller;
  let treasury: Treasury;

  /**
   * Signers
   */
  let owner: SignerWithAddress;
  let lender: SignerWithAddress;
  let borrower: SignerWithAddress;
  let addrs: SignerWithAddress[];

  before(async function () {
    // Get the signers here.
    [owner, lender, borrower, ...addrs] = await ethers.getSigners();

    /**
     * DEPLOY CONTRACTS
     */
    const registryFactory = (await ethers.getContractFactory(
      "Registry",
      owner
    )) as RegistryFactory;
    registry = await registryFactory.deploy();
    await registry.deployed();

    const aureiFactory = (await ethers.getContractFactory(
      "Aurei",
      owner
    )) as AureiFactory;
    aurei = await aureiFactory.deploy();
    await aurei.deployed();

    const custodianFactory = (await ethers.getContractFactory(
      "Custodian",
      owner
    )) as CustodianFactory;
    custodian = await custodianFactory.deploy(registry.address);
    await custodian.deployed();

    const exchangeFactory = (await ethers.getContractFactory(
      "Exchange",
      owner
    )) as ExchangeFactory;
    exchange = await exchangeFactory.deploy(registry.address);
    await exchange.deployed();

    const probityFactory = (await ethers.getContractFactory(
      "Probity",
      owner
    )) as ProbityFactory;
    probity = await probityFactory.deploy(registry.address);
    await probity.deployed();

    const tellerFactory = (await ethers.getContractFactory(
      "Teller",
      owner
    )) as TellerFactory;
    teller = await tellerFactory.deploy(registry.address);
    await teller.deployed();

    const treasuryFactory = (await ethers.getContractFactory(
      "Treasury",
      owner
    )) as TreasuryFactory;
    treasury = await treasuryFactory.deploy(registry.address);
    await treasury.deployed();

    /**
     * SET CONTRACT ADDRESSES
     */

    enum Contract {
      Aurei,
      Custodian,
      Exchange,
      Probity,
      Teller,
      Treasury,
    }

    await registry.setupContractAddress(Contract.Aurei, aurei.address);
    await registry.setupContractAddress(Contract.Custodian, custodian.address);
    await registry.setupContractAddress(Contract.Exchange, exchange.address);
    await registry.setupContractAddress(Contract.Probity, probity.address);
    await registry.setupContractAddress(Contract.Teller, teller.address);
    await registry.setupContractAddress(Contract.Treasury, treasury.address);

    await custodian.initializeContract();
    await exchange.initializeContract();
    await probity.initializeContract();
    await teller.initializeContract();
    await treasury.initializeContract();

    /**
     * VAULT SETUP
     */

    const initialCollateral = 0;
    const initialDebt = 0;
    const initialEquity = 0;

    // Create Lender's vault
    const txLender = {
      from: lender.address,
      value: web3.utils.toWei(initialCollateral.toString()),
    };
    const txResponse = await probity
      .connect(lender)
      .openVault(initialDebt, initialEquity, txLender);

    // Creating Borrower's vault
    const txBorrower = {
      from: borrower.address,
      value: web3.utils.toWei(initialCollateral.toString()),
    };
    const txBorrowerResponse = await probity
      .connect(borrower)
      .openVault(initialDebt, initialEquity, txBorrower);
  });

  describe("Lending", function () {
    it("Fails to create loan without collateral from borrower", async () => {
      const loanAmount = 50;
      const rate = 3;
      await expect(
        exchange
          .connect(borrower)
          .executeOrder(lender.address, borrower.address, loanAmount, rate)
      ).to.be.revertedWith("PRO: Insufficient collateral provided");
    });

    it("Fails to create loan without equity from lender", async () => {
      const initialCollateral = 1000;
      const initialDebt = 0;
      const initialEquity = 0;

      // Creating Borrower's vault
      const txBorrower = {
        from: borrower.address,
        value: web3.utils.toWei(initialCollateral.toString()),
      };
      const txBorrowerResponse = await probity
        .connect(borrower)
        .openVault(initialDebt, initialEquity, txBorrower);

      const loanAmount = 50;
      const rate = 3;
      await expect(
        exchange.executeOrder(
          lender.address,
          borrower.address,
          loanAmount,
          rate
        )
      ).to.be.revertedWith("TREASURY: Insufficient balance.");
    });

    it("Creates a loan with sufficient lender equity and borrower collateral", async () => {
      // Create equity on lender vault
      const initialDebt = 0;
      const initialEquity = 1000;
      const coll = 3000;

      const txLender = {
        from: lender.address,
        value: web3.utils.toWei(coll.toString()),
      };
      const txLenderResponse = await probity
        .connect(lender)
        .openVault(initialDebt, initialEquity, txLender);

      // Match borrower with lender's equity to generate loan.
      const loanAmount = 50;
      const rate = 3;
      const txLoanResponse = await exchange.executeOrder(
        lender.address,
        borrower.address,
        loanAmount,
        rate
      );
      const result = await txLoanResponse.wait();

      // LoanCreated event was emitted
      expect(result.events.length).to.equal(3);

      // Borrower loan balance changed
      expect(await teller.balanceOf(borrower.address)).to.equal(
        loanAmount.toString()
      );

      // Borrower Aurei balance changed
      expect(await aurei.balanceOf(borrower.address)).to.equal(
        loanAmount.toString()
      );
    });
  });
});
