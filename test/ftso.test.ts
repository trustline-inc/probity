import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";

import { Ftso } from "../typechain";
import deploy from "../lib/deploy";
import { expect } from "chai";

// Wallets
let owner: SignerWithAddress;
let alice: SignerWithAddress;

// Contracts
let ftso: Ftso;

describe("FTSO", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    ftso = contracts.ftso;

    // Set signers
    alice = signers.alice;
    owner = signers.owner;
  });

  describe("Price feed", function () {
    it("Sets the FLR/USD price", async function () {
      const expectedPrice = 0.8;
      await ftso.setPrice((expectedPrice * 100 + 100).toString());
      const actualPrice = await ftso.getPrice();
      expect((actualPrice.toNumber() - 100) / 100).to.equal(expectedPrice);
    });
  });
});
