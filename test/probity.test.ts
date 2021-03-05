import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, web3 } from "hardhat";
import { expect } from "chai";

describe("Probity", function() {

  // Contracts
  let Aurei, Custodian, Probity, Registry, Teller, Treasury, Exchange;

  // Instances
  let aurei, custodian, probity, registry, teller, treasury, exchange;

  // Wallets
  let addrs, owner, user;

  before(async function () {
    // Get the ContractFactory and Signers here.
    [owner, user, ...addrs] = await ethers.getSigners();

    /**
     * DEPLOY CONTRACTS
     */
    Registry = await ethers.getContractFactory("Registry");
    registry = await Registry.deploy();
    await registry.deployed();

    Aurei = await ethers.getContractFactory("Aurei");
    aurei = await Aurei.deploy();
    await aurei.deployed();

    Custodian = await ethers.getContractFactory("Custodian");
    custodian = await Custodian.deploy();
    await custodian.deployed();

    Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(registry.address);
    await exchange.deployed();

    Probity = await ethers.getContractFactory("Probity");
    probity = await Probity.deploy(registry.address);
    await probity.deployed();

    Teller = await ethers.getContractFactory("Teller");
    teller = await Teller.deploy(registry.address);
    await teller.deployed();

    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(registry.address);
    await treasury.deployed();

    /**
     * SET CONTRACT ADDRESSES
     */

    enum Contract { Aurei, Custodian, Exchange, Probity, Teller, Treasury }

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
  describe("Vault Opening", function () {
    it('Opens a vault with equity', async () => {
      const coll = 150;
      const debt = 0;
      const equity = 1;

      const tx = {from: owner.address, value: web3.utils.toWei(coll.toString())};
      const txResponse = await probity.openVault(debt, equity, tx);
      const result = await txResponse.wait();

      const [index, collateral, status]  = await probity.getVault();
      expect(collateral).to.equal(web3.utils.toWei(coll.toString()));
      expect(index).to.equal(0);

    });

    it('Opens a vault with debt', async () => {
      const coll = 150;
      const debt = 100;
      const equity = 0;
      const tx = {from: owner.address, value: web3.utils.toWei(coll.toString())};
      const txResponse = await probity.openVault(debt, equity, tx);
      const result = await txResponse.wait();

      const [index, collateral, status] = await probity.getVault();
      expect(collateral).to.equal(web3.utils.toWei(coll.toString()));
      expect(index).to.equal(1);

    });

    it('Opens a vault with equity and debt', async () => {
      const coll = 150;
      const debt = 50;
      const equity = 50;
      const tx = {from: owner.address, value: web3.utils.toWei(coll.toString())};
      const txResponse = await probity.openVault(debt, equity, tx);
      const result = await txResponse.wait();

      const [index, collateral, status] = await probity.getVault();
      expect(collateral).to.equal(web3.utils.toWei(coll.toString()));
      expect(index).to.equal(2);
    });

    it('Opens a vault with zero equity and zero debt', async () => {
      const coll = 150;
      const debt = 0;
      const equity = 0;
      const tx = {from: owner.address, value: web3.utils.toWei(coll.toString())};
      const txResponse = await probity.openVault(debt, equity, tx);
      const result = await txResponse.wait();

      const [index, collateral, status] = await probity.getVault();
      expect(collateral).to.equal(web3.utils.toWei(coll.toString()));
      expect(index).to.equal(3);
    });
    
    it('Fails to open with insufficient collateral', async () => {
      const coll = 150;
      const debt = 100;
      const equity = 100;
      const tx = {from: owner.address, value: web3.utils.toWei(coll.toString())};

      await expect(
        probity.openVault(debt, equity, tx)
      ).to.be.revertedWith("PRO: Insufficient collateral provided");
    });
  });
  describe("Exchange", function () {
    it('Fails to create loan without collateral from borrower', async () => {
      //Creating Vault for lender
      const coll = 150;
      const debt = 0;
      const equity = 0;

      const txLender = {from: owner.address, value: web3.utils.toWei(coll.toString())};
      const txLenderResponse = await probity.openVault(debt, equity, txLender);
      await txLenderResponse.wait();
      
      const loanAmount = 50;
      const rate = 3;
      await expect(
        exchange.executeOrder(owner.address,user.address, loanAmount, rate)
      ).to.be.revertedWith("PRO: Insufficient collateral provided");
    });

    it('Create loan with sufficient collateral from borrower', async () => {
      //Creating Vault for lender
      const coll = 150;
      const debt = 0;
      const equity = 0;

      const txLender = {from: owner.address, value: web3.utils.toWei(coll.toString())};
      const txLenderResponse = await probity.openVault(debt, equity, txLender);
      await txLenderResponse.wait();

      //Creating Vault for borrower
      const txBorrower = {from: user.address, value: web3.utils.toWei(coll.toString())};
      const txBorrowerResponse = await probity.connect(user).openVault(debt, equity, txBorrower);
      await txBorrowerResponse.wait();

      const loanAmount = 50;
      const rate = 3;
      await exchange.executeOrder(owner.address, user.address, loanAmount, rate);

    });
  });
});
