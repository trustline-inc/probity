import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers } from "hardhat";
import { expect } from "chai";
import * as hardhat from "hardhat";
import { Aurei, AureiMarket, MarketFactory } from "../typechain";

import deploy from "../lib/deploy";

// Wallets
let buyer: SignerWithAddress;
let seller: SignerWithAddress;
let liquidityProvider: SignerWithAddress;

// Contracts
let aurei: Aurei;
let aureiMarket: AureiMarket;
let marketFactory: MarketFactory;

describe("Exchange", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    aurei = contracts.aurei;
    marketFactory = contracts.marketFactory;

    // Set signers
    buyer = signers.alice;
    seller = signers.bob;
    liquidityProvider = signers.charlie;
  });

  describe("Aurei Markets", async function () {
    it("deploys a market", async () => {
      const response = await marketFactory.createExchange(aurei.address);
      expect(response).to.emit(marketFactory, "NewExchange");
      const { events } = await response.wait();
      const address = events[1].args.exchange;
      const abi = (await hardhat.artifacts.readArtifact("AureiMarket")).abi;
      aureiMarket = new ethers.Contract(address, abi) as AureiMarket;
    });

    describe("liquidity provision", async () => {
      it("reverts with invalid caller", async () => {
        await expect(
          aureiMarket
            .connect(liquidityProvider)
            .addLiquidity(10, 10, 0, { gasLimit: 40000 })
        ).to.be.revertedWith(
          "AUREI_MARKET: Only Treasury can call this method."
        );
      });
    });
  });
});
