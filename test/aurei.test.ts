import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";

import { contracts, deploy, signers } from "./helpers";

const { owner, alice } = signers;
const { aurei } = contracts;

describe("Aurei", function () {
  before(async function () {
    await deploy();
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
