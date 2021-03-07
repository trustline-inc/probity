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

describe("Custodian", function () {
  // Contracts
  let aurei: Aurei;
  let exchange: Exchange;
  let custodian: Custodian;
  let probity: Probity;
  let registry: Registry;
  let teller: Teller;
  let treasury: Treasury;

  /**
   * Signers
   */
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let don: SignerWithAddress;
  let addrs: SignerWithAddress[];

  before(async function () {
    // Get the signers here.
    [owner, alice, bob, charlie, don, ...addrs] = await ethers.getSigners();

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

    await exchange.initializeContract();
    await probity.initializeContract();
    await teller.initializeContract();
    await treasury.initializeContract();
  });

  describe("Vault Management", function () {
    describe("Opening a vault", function () {
      it("Opens a vault without equity", async () => {
        const coll = 150;
        const debt = 0;
        const equity = 0;

        // Create Alice's vault
        const tx = {
          from: alice.address,
          value: web3.utils.toWei(coll.toString()),
        };
        const txResponse = await probity
          .connect(alice)
          .openVault(debt, equity, tx);
        const result = await txResponse.wait();

        // Check Alice's equity balance in treasury
        const treasuryBalance = await treasury.balanceOf(alice.address);
        expect(treasuryBalance.toString()).to.equal("0");

        // Check Alice's vault details
        const vault = await probity.connect(alice).getVault();
        expect(vault[0]).to.equal(1);
        expect(web3.utils.fromWei(vault[1].toString())).to.equal(
          coll.toString()
        );

        // Check Alice's equity and debt balances
        expect(await treasury.balanceOf(alice.address)).to.equal(
          equity.toString()
        );
        expect(await teller.balanceOf(alice.address)).to.equal(debt.toString());
      });

      it("Opens a vault with equity", async () => {
        const coll = 150;
        const debt = 0;
        const equity = 100;

        // Create Bob's vault
        const tx = {
          from: bob.address,
          value: web3.utils.toWei(coll.toString()),
        };
        const txResponse = await probity
          .connect(bob)
          .openVault(debt, equity, tx);
        const result = await txResponse.wait();

        // Check Bob's equity balance in treasury
        const treasuryBalance = await treasury.balanceOf(bob.address);
        expect(treasuryBalance.toString()).to.equal("100");

        // Check Bob's vault details
        const vault = await probity.connect(bob).getVault();
        expect(vault[0]).to.equal(2);
        expect(web3.utils.fromWei(vault[1].toString())).to.equal(
          coll.toString()
        );

        // Check Bob's equity and debt balances
        expect(await treasury.balanceOf(bob.address)).to.equal(
          equity.toString()
        );
        expect(await teller.balanceOf(bob.address)).to.equal(debt.toString());
      });

      it("Opens a vault without collateral", async () => {
        const coll = 0;
        const debt = 0;
        const equity = 0;

        // Create Charlie's vault
        const tx = {
          from: charlie.address,
          value: web3.utils.toWei(coll.toString()),
        };
        const txResponse = await probity
          .connect(charlie)
          .openVault(debt, equity, tx);
        const result = await txResponse.wait();

        // Check Charlie's equity balance in treasury
        const treasuryBalance = await treasury.balanceOf(charlie.address);
        expect(treasuryBalance.toString()).to.equal("0");

        // Check Charlie's collateral
        const vault = await probity.connect(charlie).getVault();
        expect(vault[0]).to.equal(3);
        expect(web3.utils.fromWei(vault[1].toString())).to.equal(
          coll.toString()
        );

        // Check Charlie's equity and debt balances
        expect(await treasury.balanceOf(charlie.address)).to.equal(
          equity.toString()
        );
        expect(await teller.balanceOf(charlie.address)).to.equal(
          debt.toString()
        );
      });

      it("Fails to open with insufficient collateral", async () => {
        const coll = 0;
        const debt = 100;
        const equity = 100;
        const tx = {
          from: don.address,
          value: web3.utils.toWei(coll.toString()),
        };

        // Expect Don's vault to fail creation
        await expect(
          probity.connect(don).openVault(debt, equity, tx)
        ).to.be.revertedWith("PRO: Insufficient collateral provided");
      });
    });

    describe("Managing a vault", function () {
      it("Allows the user to withdraw equity", async () => {
        // TODO
      });

      it("Fails to close a non-empty vault", async () => {
        // TODO
      });

      it("Withdraws collateral from vault", async () => {
        // TODO
      });

      it("Fails to withdraw collateral from empty vault", async () => {
        // TODO
      });
    });

    describe("Closing a vault", function () {
      it("Fails to close a non-empty vault", async () => {
        // TODO
      });

      it("Closes an empty vault", async () => {
        // TODO
      });
    });
  });
});
