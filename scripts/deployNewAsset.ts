import "@nomiclabs/hardhat-ethers";
import {
  probity,
  Deployment,
  mock,
  parseExistingContracts,
} from "../lib/deployer";
import * as fs from "fs";
import * as hre from "hardhat";
import { web3 } from "hardhat";

async function main() {
  let deployment: Deployment;
  let contracts;

  // what is needed in a new asset?
  // FTSO
  // PriceFeed
  // ASSET TYPE (ERC20, VPAssetManager, Native)
  // Asset name

  // check if all relevant contracts exists
  // Vault Engine
  // Teller
  // PriceFeed
  // Liquidator

  // check for settings
  // whether to deploy mockFTSO or not
  // which asset Type
  // asset name

  const contractsToCheck = [
    "REGISTRY",
    "VAULT_ENGINE",
    "PRICE_FEED",
    "TELLER",
    "LIQUIDATOR",
  ];

  await checkContractAddresses(contractsToCheck);
  await checkSettings(process.argv);
  await parseExistingContracts();

  const assetId = web3.utils.keccak256(process.env.ASSET_NAME);

  // deploy the new assetManager Contracts
  switch (process.env.ASSET_TYPE) {
    case "Native":
      contracts = probity.deployNativeAssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
      });
      break;
    case "ERC20":
      // we need erc20 address
      contracts = probity.deployERC20AssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
      });
      break;
    case "VPAssetManager":
      // we need vpToken address
      // ftsoManger address
      // ftsoRewardManager address
      contracts = probity.deployVPAssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
      });
      break;
    default:
      logErrorAndExit(`Unknown ASSET_TYPE`);
      break;
  }

  // deploy FTSO - if needed

  // initialize the assets

  // initializing in Vault Engine
  contracts.vaultEngine.initAssetType(assetId);
  // initializing in Teller
  contracts.teller.initAssetType(assetId);
  // initializing in Liquidator
  contracts.liquidator.initAssetType(assetId);
  // initializing in PriceFeed
  // need liquidationRatio + Ftso address
  contracts.priceFeed.initAssetType(assetId);
  // update Price in priceFeed
  contracts.priceFeed.updateAdjustedPrice(assetId);
}

async function checkContractAddresses(contractNames) {
  for (let contractName of contractNames) {
    if (process.env[contractName] === null) {
      logErrorAndExit(
        `Missing contract Address for ${contractName}, please set it in env variable`
      );
    }
  }
}

async function checkSettings(settings) {
  const SUPPORTED_ASSET_TYPES = ["Native", "VPAssetManager", "ERC20"];

  // ASSET_NAME
  if (process.env.ASSET_NAME === null) {
    logErrorAndExit(`ASSET_NAME is not provided`);
  }

  // ASSET_TYPE
  if (
    process.env.ASSET_TYPE === null ||
    !SUPPORTED_ASSET_TYPES.includes(process.env.ASSET_TYPE)
  ) {
    logErrorAndExit(
      `Please provide a supported ASSET_TYPE (Native, VPAssetManager, ERC20)`
    );
  }

  // DEPLOY_FTSO
  if (
    process.env.DEPLOY_FTSO === null ||
    process.env.DEPLOY_FTSO.toLowerCase() === "false"
  ) {
    if (process.env.FTSO === null) {
      logErrorAndExit(`FTSO address is needed when DEPLOY_FTSO=false`);
    }
  }
}

function logErrorAndExit(message) {
  console.error(message);
  process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
