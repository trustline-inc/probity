import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Aurei contract", function() {

  // Contracts
  let Aurei;
  let Teller;
  let Treasury;

  // Instances
  let aurei;
  let teller;
  let treasury;
  
  // Wallets
  let owner;
  let addr1;
  let addr2;
  let addrs;
  
  before(async function () {
    // Get the ContractFactory and Signers here.
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    
    Teller = await ethers.getContractFactory("Teller");
    teller = await Teller.deploy();
    await teller.deployed();

    Aurei = await ethers.getContractFactory("Aurei");
    // const aureiOwnerAddress = teller.address;
    const aureiOwnerAddress = owner.address;
    aurei = await Aurei.deploy(aureiOwnerAddress);
    await aurei.deployed();
    
    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(aurei.address);
    await treasury.deployed();
    
  });

  describe("Deployment", function () {

    it("Should set the right owner", async function () {
      expect(await aurei.owner()).to.equal(aureiTokenOwnerAddress);
    });

    it("Total supply of the token must be 0", async function () {
      expect(await aurei.totalSupply()).to.equal(0);
    });
    
    it("Owner Balance of the token must be equal to total supply", async function () {
      const ownerBalance = await aurei.balanceOf(aureiTokenOwnerAddress);
      expect(await aurei.totalSupply()).to.equal(ownerBalance);
    });
  });
  
  describe("Transactions", function () {

    it("Minting new tokens and verify owner balance and token supply", async function () {
      await treasury.mint(100);
      const ownerBalance = await aurei.balanceOf(aureiTokenOwnerAddress);
      expect(ownerBalance).to.equal(100);
      expect(await aurei.totalSupply()).to.equal(100);
    });

    it("Burning Tokens and verify owner balance and token supply", async function () {
      await treasury.burn(20);
      const ownerBalance = await aurei.balanceOf(aureiTokenOwnerAddress);
      expect(ownerBalance).to.equal(80);
      expect(await aurei.totalSupply()).to.equal(80);
    });

    it("Transfer tokens to another address", async function () {
      await aurei.transfer(addr1.address, 20);
      expect(await aurei.balanceOf(addr1.address)).to.equal(20);
    });

  });   
});
