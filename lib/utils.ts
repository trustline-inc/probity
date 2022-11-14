import * as dotenv from "dotenv";
import * as hre from "hardhat";
import "hardhat-ethernal";
dotenv.config();

import {
  CONFIGURABLE_NATIVE_TOKEN_NETWORKS,
  ETHERNAL_WORKSPACE_NAME,
  NATIVE_TOKENS
} from "./constants"
import { Deployment } from "./types"

/**
 * @function deployToNetwork
 * @dev Deploys to the target network environment.
 * @returns {object} Deployment
 */
const deployToNetwork = async (): Deployment => {
  let deployment: Deployment;
  if (DEVELOPMENT_NETWORKS.includes(hre.network.name)) {
    console.info("Deploying to local environment in DEV mode.");
    deployment = await deploy("Development");
  } else {
    console.info("Deploying to remote environment in PROD mode.");
    deployment = await deploy("Production");
    const message = `
      Production deployments do not include:
        • ERC20AssetManager
        • VPAssetManager
        • Auctioneer
      Please deploy them separately.
    `;
    console.warn(message);
  }
  console.info(`Deployment to ${hre.network.name} was a success!`);
  return deployment;
}


/**
 * @function getNativeToken
 * @returns {string} symbol of the native token
 */
const getNativeToken = (): string => {
  let nativeToken;

  const network = hre.network.name;

  // Support configurable native token for applicable networks
  if (CONFIGURABLE_NATIVE_TOKEN_NETWORKS.includes(network)) {
    if (process.env.NATIVE_TOKEN) {
      if (!NATIVE_TOKENS.includes(process.env.NATIVE_TOKEN!?.toUpperCase()))
        throw Error("Invalid native token type.");
      nativeToken = process.env.NATIVE_TOKEN.toUpperCase()
    } else throw Error("Must set the NATIVE_TOKEN environment variable.");
  } else {
    nativeToken = {
      coston: "CFLR",
      flare: "FLR",
      songbird: "SGB"
    }[network]
  }

  return nativeToken!;
};

/**
 * @function resetEthernalWorkspace
 * @dev Resets the Ethernal workspace
 */
const resetEthernalWorkspace = async () => {
  if (process.env.NODE_ENV !== "test")
    if (hre.ethernal.api.auth.currentUser)
      await hre.ethernal.resetWorkspace(ETHERNAL_WORKSPACE_NAME);
}

/**
 * @function writeContractsToFile
 */
 const writeContractsToFile = () => {}

/**
 * @function dispalyContractsInConsole
 */
const dispalyContractsInConsole = () => {}

/**
 * @function bytes32
 * @param string 
 * @returns {string}
 */
const bytes32 = (string: string): string => ethers.utils.formatBytes32String(string);

export {
  bytes32,
  getNativeToken,
  resetEthernalWorkspace,
  writeContractsToFile,
  dispalyContractsInConsole,
};
