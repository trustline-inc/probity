import "@nomiclabs/hardhat-ethers";
import "hardhat-ethernal";
import * as hre from "hardhat";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import Factory from "@uniswap/v2-core/build/UniswapV2Factory.json";
import Router from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

async function main() {
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  // The base asset trades with all other assets
  const baseAsset = process.env.USD;

  if (!baseAsset) {
    console.error("Please set a base asset");
    process.exit(1);
  }

  const factory = await new ethers.ContractFactory(
    Factory.interface,
    Factory.bytecode,
    owner
  ).deploy(owner.address);
  const router = await new ethers.ContractFactory(
    Router.abi,
    Router.bytecode,
    owner
  ).deploy(factory.address, baseAsset);

  // TODO: Ensure that ERC20s are deployed and envvars are set
  const assetA = process.env.USD;
  const assetB = process.env.LQO;

  if (!assetA || !assetB) {
    console.log("Please set asset pair");
    console.log(`Values for (A, B) are: (${assetA}, ${assetB})`);
    process.exit(1);
  }

  const result = await factory.createPair(assetA, assetB);
  console.log("Uniswap contracts deployed!");
  console.table({
    factory: factory.address,
    router: router.address,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
