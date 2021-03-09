import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Aurei } from "../typechain";

import deploy from "./helpers";

// Declare in global scope
let owner: SignerWithAddress;
let alice: SignerWithAddress;
let aurei: Aurei;

describe("Aurei", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    aurei = contracts.aurei;

    // Set signers
    alice = signers.alice;
    owner = signers.owner;
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await aurei.owner()).to.equal(owner.address);
    });

    it("Total supply of the token must be 0", async function () {
      expect(await aurei.totalSupply()).to.equal(0);
    });

    it("Owner Balance of the token must be equal to total supply", async function () {
      const ownerBalance = await aurei.balanceOf(owner.address);
      expect(await aurei.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Transactions", function () {
    it("Minting new tokens and verify owner balance and token supply", async function () {
      await aurei.mint(owner.address, 100);
      const ownerBalance = await aurei.balanceOf(owner.address);
      expect(ownerBalance).to.equal(100);
      expect(await aurei.totalSupply()).to.equal(100);
    });

    it("Burning Tokens and verify owner balance and token supply", async function () {
      await aurei.burn(owner.address, 20);
      const ownerBalance = await aurei.balanceOf(owner.address);
      expect(ownerBalance).to.equal(80);
      expect(await aurei.totalSupply()).to.equal(80);
    });

    it("Transfer tokens to another address", async function () {
      await aurei.transfer(alice.address, 20);
      expect(await aurei.balanceOf(alice.address)).to.equal(20);
    });
  });
});
