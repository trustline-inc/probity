import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";

import { Aurei } from "../typechain";
import deploy from "../lib/deploy";

// Wallets
let owner: SignerWithAddress;
let alice: SignerWithAddress;

// Contracts
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
    it("Sets the owner to the deployer", async function () {
      expect(await aurei.owner()).to.equal(owner.address);
    });

    it("Starts with zero supply", async function () {
      expect(await aurei.totalSupply()).to.equal(0);
    });
  });

  describe("Transactions", function () {
    it("Mints new tokens", async function () {
      await aurei.mint(owner.address, 100);
      const ownerBalance = await aurei.balanceOf(owner.address);
      expect(ownerBalance).to.equal(100);
      expect(await aurei.totalSupply()).to.equal(100);
    });

    it("Burns tokens", async function () {
      await aurei.burn(owner.address, 20);
      const ownerBalance = await aurei.balanceOf(owner.address);
      expect(ownerBalance).to.equal(80);
      expect(await aurei.totalSupply()).to.equal(80);
    });

    it("Transfers tokens", async function () {
      await aurei.transfer(alice.address, 20);
      expect(await aurei.balanceOf(alice.address)).to.equal(20);
    });
  });
});
