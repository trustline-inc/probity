import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Aurei", function() {

  // Contracts
  let Aurei;

  // Instances
  let aurei;
  
  // Wallets
  let owner;
  let addr1;
  let addr2;
  let addrs;

  // Contract Owners
  let aureiOwnerAddress;
  
  before(async function () {
    // Get the ContractFactory and Signers here.
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    Aurei = await ethers.getContractFactory("Aurei");
    aureiOwnerAddress = owner.address;
    aurei = await Aurei.deploy(aureiOwnerAddress);
    await aurei.deployed();
  });

  describe("Deployment", function () {

    it("Should set the right owner", async function () {
      expect(await aurei.owner()).to.equal(aureiOwnerAddress);
    });

    it("Total supply of the token must be 0", async function () {
      expect(await aurei.totalSupply()).to.equal(0);
    });
    
    it("Owner Balance of the token must be equal to total supply", async function () {
      const ownerBalance = await aurei.balanceOf(aureiOwnerAddress);
      expect(await aurei.totalSupply()).to.equal(ownerBalance);
    });
  });
  
  describe("Transactions", function () {

    it("Minting new tokens and verify owner balance and token supply", async function () {
      await aurei.mint(owner.address, 100);
      const ownerBalance = await aurei.balanceOf(aureiOwnerAddress);
      expect(ownerBalance).to.equal(100);
      expect(await aurei.totalSupply()).to.equal(100);
    });

    it("Burning Tokens and verify owner balance and token supply", async function () {
      await aurei.burn(owner.address, 20);
      const ownerBalance = await aurei.balanceOf(aureiOwnerAddress);
      expect(ownerBalance).to.equal(80);
      expect(await aurei.totalSupply()).to.equal(80);
    });

    it("Transfer tokens to another address", async function () {
      await aurei.transfer(addr1.address, 20);
      expect(await aurei.balanceOf(addr1.address)).to.equal(20);
    });

  });   
});
