import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { web3 } from "hardhat";
import { expect } from "chai";
import { Decimal } from "decimal.js";
import BigNumber from "bignumber.js";

import { Aurei, AureiMarket, MarketFactory } from "../typechain";
import deploy from "../lib/deploy";

// Wallets
let buyer: SignerWithAddress;
let seller: SignerWithAddress;

// Contracts
let aurei: Aurei;
let aureiMarket: AureiMarket;
let marketFactory: MarketFactory;

// Global timestamp variable
var lastUpdated;

describe("Exchange", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    aurei = contracts.aurei;
    marketFactory = contracts.marketFactory;

    // Set signers
    buyer = signers.alice;
    seller = signers.bob;
  });

  describe("Aurei Markets", async function () {
    it("deploys a market", async () => {
      const response = await marketFactory.createExchange(aurei.address);
      expect(response).to.emit(marketFactory, "NewExchange");
      const { events } = await response.wait();
      const exchange = events[1].args.exchange;
    });
  });
});
