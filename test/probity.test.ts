import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, web3 } from "hardhat";
import { expect } from "chai";

describe("Probity", function() {

  // Contracts
  let Registry;
  let Aurei;
  let Probity;
  let Teller;
  let Treasury;
  let VaultManager;

  // Instances
  let aurei;
  let probity;
  let teller;
  let treasury;
  let vaultManager;
  let registry;

  // Wallets
  let owner;
  let user;
  let addrs;

  enum Contract { Teller, Treasury, VaultManager, Aurei, Probity };
  enum Status {
    Active,
    Closed,
    NonExistent
  };

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

    Teller = await ethers.getContractFactory("Teller");
    teller = await Teller.deploy();
    await teller.deployed();

    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(registry.address);
    await treasury.deployed();

    VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy();
    await vaultManager.deployed();

    Probity = await ethers.getContractFactory("Probity");
    probity = await Probity.deploy(registry.address);
    await probity.deployed();

    /**
     * SET CONTRACT ADDRESSES
     */

    await registry.setupContractAddress(Contract.Teller, teller.address);
    await registry.setupContractAddress(Contract.Treasury, treasury.address);
    await registry.setupContractAddress(Contract.VaultManager, vaultManager.address);
    await registry.setupContractAddress(Contract.Aurei, aurei.address);
    await registry.setupContractAddress(Contract.Probity, probity.address);

    await probity.initializeContract();
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

      const [index,collateral, status]  = await probity.getCollateralDetails(owner.address);
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

      const [index,collateral, status] = await probity.getCollateralDetails(owner.address);
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

      const [index,collateral, status] = await probity.getCollateralDetails(owner.address);
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

      const [index,collateral, status] = await probity.getCollateralDetails(owner.address);
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
});
