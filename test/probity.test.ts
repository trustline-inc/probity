import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, web3 } from "hardhat";
import { expect } from "chai";

describe("Probity", function() {

  // Contracts
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
  
  // Wallets
  let owner;
  let user;
  let addrs;
  
  before(async function () {
    // Get the ContractFactory and Signers here.
    [owner, user, ...addrs] = await ethers.getSigners();

    /** 
     * DEPLOY CONTRACTS
     */

    Aurei = await ethers.getContractFactory("Aurei");
    aurei = await Aurei.deploy();
    await aurei.deployed();

    Teller = await ethers.getContractFactory("Teller");
    teller = await Teller.deploy();
    await teller.deployed();

    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.deployed();

    VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy();
    await vaultManager.deployed();

    Probity = await ethers.getContractFactory("Probity");
    probity = await Probity.deploy();
    await probity.deployed();

    /**
     * SET CONTRACT ADDRESSES
     */

    // 0 = Aurei, 1 = Probity
    await treasury.setAddress(0, aurei.address);
    await treasury.setAddress(1, probity.address);

    // 0 = Teller, 1 = Treasury, 2 = VaultManager
    await probity.setAddress(0, teller.address);
    await probity.setAddress(1, treasury.address);
    await probity.setAddress(2, vaultManager.address);
  });

  it('Opens a vault with equity', async () => {
    const coll = 150;
    const debt = 0;
    const equity = 100;
    const tx = { from: owner.address, value: web3.utils.toWei(coll.toString()) };

    const result = await probity.openVault(debt, equity, tx);

    console.log("Result:", result);

    // expect(result).to.equal(0);
  });

  it('Opens a vault with debt', async () => {
    const coll = 150;
    const debt = 100;
    const equity = 0;
    const tx = { from: owner.address, value: web3.utils.toWei(coll.toString()) };

    // HOW TO CAPTURE EVENT?

    // await expect(token.transfer(walletTo.address, 7))
    //   .to.emit(token, 'Transfer')
    //   .withArgs(wallet.address, walletTo.address, 7);

    expect(await probity.openVault(debt, equity, tx)).to.equal(1);
  });

  it('Opens a vault with equity and debt', async () => {
    const coll = 150;
    const debt = 50;
    const equity = 50;
    const tx = { from: owner.address, value: web3.utils.toWei(coll.toString()) };
    expect(await probity.openVault(debt, equity, tx)).to.equal(2);
  });

  it('Fails to open with insufficient collateral', async () => {
    const coll = 150;
    const debt = 100;
    const equity = 100;
    const tx = { from: owner.address, value: web3.utils.toWei(coll.toString()) };
    
    await expect(
      probity.openVault(debt, equity, tx)
    ).to.be.revertedWith("PRO: Insufficient collateral provided");
  });
  
});
