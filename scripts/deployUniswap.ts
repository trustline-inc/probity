import "@nomiclabs/hardhat-ethers";
import "hardhat-ethernal";
import * as hre from "hardhat";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import Factory from "@uniswap/v2-core/build/UniswapV2Factory.json";
import Router from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

async function main() {
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  const factory = await new ethers.ContractFactory(
    Factory.interface,
    Factory.bytecode,
    owner
  ).deploy(owner.address);
  const router = await new ethers.ContractFactory(
    Router.abi,
    Router.bytecode,
    owner
  ).deploy(factory.address, process.env.USD);

  const result = await factory.createPair(process.env.USD, process.env.LQO);
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
