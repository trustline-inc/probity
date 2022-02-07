import "@nomiclabs/hardhat-ethers";
import { probity, mock, parseExistingContracts } from "../lib/deployer";
import * as fs from "fs";
import * as hre from "hardhat";
import { ethers, web3 } from "hardhat";

async function main() {
  let contracts;

  const contractsToCheck = [
    "REGISTRY",
    "VAULT_ENGINE",
    "PRICE_FEED",
    "TELLER",
    "LIQUIDATOR",
  ];

  await checkContractAddresses(contractsToCheck);
  await checkSettings();
  await parseExistingContracts();

  const assetId = web3.utils.keccak256(process.env.ASSET_NAME);

  // deploy the new assetManager Contracts
  switch (process.env.ASSET_TYPE) {
    case "Native":
      contracts = await probity.deployNativeAssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
      });
      break;
    case "ERC20":
      await checkContractAddresses(["ERC20"]);
      // we need erc20 address
      contracts = await probity.deployERC20AssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
        mockErc20Token: process.env.ERC20,
      });
      break;
    case "VPToken":
      await checkContractAddresses([
        "FTSO_MANAGER",
        "FTSO_REWARD_MANAGER",
        "VP_TOKEN",
      ]);
      // we need vpAssetManager address
      // ftsoManger address
      // ftsoRewardManager address
      contracts = await probity.deployVPAssetManager({
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
  const deployed = await mock.deployMockFtso();
  const ftso = contracts.ftso ? contracts.ftso.address : deployed.ftso.address;
  // deploy Auctioneer
  await probity.deployAuctioneer();

  // initialize the assets
  // initializing in Vault Engine
  await contracts.vaultEngine.initAssetType(assetId);
  // initializing in Teller
  await contracts.teller.initCollType(assetId, process.env.PROTOCOL_FEE);
  // initializing in Liquidator
  await contracts.liquidator.initAssetType(
    assetId,
    contracts.auctioneer.address
  );
  // initializing in PriceFeed
  // need liquidationRatio + Ftso address

  await contracts.priceFeed.initAssetType(
    assetId,
    ethers.utils.parseEther(process.env.LIQUIDATION_RATIO),
    ftso
  );
  // update Price in priceFeed
  await contracts.priceFeed.updateAdjustedPrice(assetId);
}

async function checkContractAddresses(contractNames) {
  for (let contractName of contractNames) {
    console.log(contractName, process.env[contractName]);
    if (process.env[contractName] === undefined) {
      logErrorAndExit(
        `Missing contract Address for ${contractName}, please set it in env variable`
      );
    }
  }
}

async function checkSettings() {
  const SUPPORTED_ASSET_TYPES = ["Native", "VPToken", "ERC20"];
  const settingsToCheck = [
    "ASSET_NAME",
    "ASSET_TYPE",
    "DEPLOY_FTSO",
    "LIQUIDATION_RATIO",
    "PROTOCOL_FEE",
  ];

  for (let setting of settingsToCheck) {
    if (process.env[setting] === undefined) {
      logErrorAndExit(`Missing Setting for ${setting}`);
    }
  }

  // ASSET_TYPE
  if (!SUPPORTED_ASSET_TYPES.includes(process.env.ASSET_TYPE)) {
    logErrorAndExit(
      `Please provide a supported ASSET_TYPE (Native, VPToken, ERC20)`
    );
  }

  // DEPLOY_FTSO
  if (process.env.DEPLOY_FTSO === "false" && process.env.FTSO === undefined) {
    logErrorAndExit(`FTSO address is needed when DEPLOY_FTSO=false`);
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
