/**
 * This script currently only supports a LQO ERC20 token.
 * REGISTRY must be deployed and environment variable set.
 */
import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
// Import ERC20 types as shown below
import { LQO, LQO__factory } from "../typechain";

(async () => {
  const signers = await ethers.getSigners();

  // Create a factory for the ERC20 token
  const lqoFactory = (await ethers.getContractFactory(
    "LQO",
    signers.owner
  )) as LQO__factory;

  // Deploy contract
  const lqo = await lqoFactory.deploy(process.env.REGISTRY);

  // Log contract info
  console.log(lqo.address);
  console.log(lqo.deployTransaction);
})();
