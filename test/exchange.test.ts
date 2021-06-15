import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, web3 } from "hardhat";
import { expect } from "chai";
import * as hardhat from "hardhat";
import {
  Aurei,
  AureiMarket,
  Comptroller,
  Ftso,
  MarketFactory,
} from "../typechain";

import deploy from "../lib/deploy";

// Wallets
let buyer: SignerWithAddress;
let seller: SignerWithAddress;
let liquidityProvider: SignerWithAddress;

// Contracts
let aurei: Aurei;
let aureiMarket: AureiMarket;
let comptroller: Comptroller;
let ftso: Ftso;
let marketFactory: MarketFactory;

describe("Exchange", function () {
  before(async function () {
    const { contracts, signers } = await deploy();

    // Set contracts
    aurei = contracts.aurei;
    comptroller = contracts.comptroller;
    ftso = contracts.ftso;
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
      aureiMarket = new ethers.Contract(
        address,
        abi,
        ethers.provider
      ) as AureiMarket;
    });

    describe("liquidity provision", async () => {
      it("reverts with invalid caller", async () => {
        await expect(
          aureiMarket.connect(liquidityProvider).addLiquidity(0, 0, 0)
        ).to.be.revertedWith(
          "AUREI_MARKET: Only Comptroller can call this method."
        );
      });

      it("adds liquidity", async () => {
        const balance1 = await liquidityProvider.getBalance();
        console.log("balance1:", balance1.toString());
        await ftso.setPrice("100000"); // FLR/XAU = 1000.00
        await expect(
          await comptroller
            .connect(liquidityProvider)
            .deposit(aureiMarket.address, { value: web3.utils.toWei("5000") })
        ).to.emit(aureiMarket, "AddLiquidity");
        expect(
          (await aurei.balanceOf(aureiMarket.address)).toString()
        ).to.equal(web3.utils.toWei("5"));
        expect(await ethers.provider.getBalance(aureiMarket.address)).to.equal(
          web3.utils.toWei("5000")
        );
        const balance2 = await liquidityProvider.getBalance();
        console.log("balance2:", balance1.toString());
      });
    });

    describe("liquidity withdrawal", async () => {
      it("reverts without PEG burn", async () => {
        await expect(
          comptroller
            .connect(liquidityProvider)
            .withdraw(
              aureiMarket.address,
              web3.utils.toWei("0"),
              web3.utils.toWei("1000")
            )
        ).to.be.revertedWith("AUREI_MARKET: Must burn PEG tokens.");
      });

      it("withdraws liquidity", async () => {
        /**
         * Buyer buys 0.45 AUR to create liquidity provider PEG tokens
         */

        const balancePrior = await aureiMarket.balanceOf(comptroller.address);
        expect(balancePrior.toString()).to.equal(web3.utils.toWei("5000"));

        // Accounting for fees
        const minimumAureiBought = web3.utils.toWei("0.45");

        await aureiMarket
          .connect(buyer)
          .flrToAurSwapInput(
            minimumAureiBought,
            Math.floor(Date.now() / 1000) + 100,
            { value: web3.utils.toWei("500") }
          );
        const balanceAfter = await aureiMarket.balanceOf(comptroller.address);
        console.log("balance after trade:", balanceAfter.toString());
        // expect(balanceAfter.toString()).to.equal();

        const liquidityTokensBurned = web3.utils.toWei("100");
        const minimumSparkWithdrawn = web3.utils.toWei("10");
        await expect(
          comptroller
            .connect(liquidityProvider)
            .withdraw(
              aureiMarket.address,
              liquidityTokensBurned,
              minimumSparkWithdrawn
            )
        ).to.emit(aureiMarket, "RemoveLiquidity");
        expect(
          (await aurei.balanceOf(aureiMarket.address)).toString()
        ).to.equal(web3.utils.toWei("4.455760661998726927"));
        expect(await ethers.provider.getBalance(aureiMarket.address)).to.equal(
          web3.utils.toWei("5390.000000000000000000")
        );
        const balance = await liquidityProvider.getBalance();
        console.log("balance:", balance.toString());
      });
    });
  });
});
