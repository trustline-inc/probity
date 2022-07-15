/**
 * Deploy New Asset script
 * This will deploy new asset manager contract and initialize them in relevant contracts
 * Usage:
 *  All Settings and necessary Info should be set through env variables
 *
 *
 *  Required Variables:
 *    contract addresses:
 *      - REGISTRY
 *      - VAULT_ENGINE
 *      - PRICE_FEED
 *      - TELLER
 *      - LIQUIDATOR
 *      - FTSO (if DEPLOY_FTSO=false)
 *      - ERC20 (if ASSET_TYPE=ERC20)
 *      - FTSO_MANAGER (if ASSET_TYPE=VPToken)
 *      - FTSO_REWARD_MANAGER (if ASSET_TYPE=VPToken)
 *      - VP_TOKEN (if ASSET_TYPE=VPToken)
 *    Settings:
 *      - ASSET_NAME (String)
 *      - ASSET_TYPE (Native, VPToken, ERC20)
 *      - DEPLOY_FTSO (boolean)
 *      - LIQUIDATION_RATIO (float, 1.5 = 150%)
 *      - PROTOCOL_FEE (float, 0.01 = 1%)
 *      - DEPLOYMENT_DELAY (int) : Adds delay between deployment of contracts
 *      - DELAY (int) : Adds delay between contract calls
 */

import "@nomiclabs/hardhat-ethers";
import { probity, mock, parseExistingContracts } from "../lib/deployer";
import { ethers, web3 } from "hardhat";

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function main() {
  let contracts: any;

  const contractsToCheck = [
    "REGISTRY",
    "VAULT_ENGINE",
    "PRICE_FEED",
    "TELLER",
    "LIQUIDATOR",
  ];

  await checkContractAddresses(contractsToCheck);
  await checkSettings();
  contracts = await parseExistingContracts();

  const assetId = web3.utils.keccak256(process.env.ASSET_NAME!);

  // deploy the new assetManager Contracts
  console.info("Deploying Asset Manager");
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

      // TODO: fix deployERC20AssetManager erasing ftso address
      if (contracts.ftso) var temp = contracts.ftso;

      // we need erc20 address
      contracts = await probity.deployERC20AssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
        erc20: process.env.USD,
      });
      contracts.ftso = temp;
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
        mockVpToken: process.env.VP_TOKEN,
        ftsoManager: process.env.FTSO_MANAGER,
        ftsoRewardManager: process.env.FTSO_REWARD_MANAGER,
      });
      break;
    default:
      logErrorAndExit(`Unknown ASSET_TYPE`);
      break;
  }

  let ftso;
  // deploy FTSO - if needed
  if (process.env.DEPLOY_FTSO === "true") {
    console.info("Deploying Mock FTSO");
    const deployed = await mock.deployMockFtso();
    ftso = deployed!.ftso?.address;
  } else {
    console.info("Skipping Deploying FTSO");
    ftso = contracts.ftso.address;
  }

  // deploy Auctioneer
  console.info("Deploying Auctioneer");
  await probity.deployAuctioneer();

  await execute(
    contracts.vaultEngine.initAsset(assetId, { gasLimit: 300000 }),
    "Initializing Asset on VaultEngine"
  );

  await execute(
    contracts.teller.initAsset(
      assetId,
      ethers.utils.parseEther(process.env.LIQUIDATION_RATIO!),
      { gasLimit: 300000 }
    ),
    "Initializing Asset on teller"
  );

  await execute(
    contracts.liquidator.initAsset(assetId, contracts.auctioneer.address, {
      gasLimit: 300000,
    }),
    "Initializing Asset on liquidator"
  );

  await execute(
    contracts.priceFeed.initAsset(
      assetId,
      ethers.utils.parseEther(process.env.LIQUIDATION_RATIO!),
      ftso,
      { gasLimit: 300000 }
    ),
    "Initializing Asset on priceFeed"
  );

  await execute(
    contracts.priceFeed.updateAdjustedPrice(assetId, { gasLimit: 300000 }),
    "Updating Adjusted Price on priceFeed"
  );
}

async function checkContractAddresses(contractNames) {
  console.info("Checking if necessary contract addresses are present");
  for (let contractName of contractNames) {
    if (process.env[contractName] === undefined) {
      logErrorAndExit(
        `Missing contract Address for ${contractName}, please set it in env variable`
      );
    }
  }
}

async function execute(promise, message) {
  console.info(message);
  await promise;
  await checkDelay();
}

async function checkDelay() {
  if (process.env.DELAY === undefined) return;
  const delayTime = parseInt(process.env.DELAY);
  console.log(`sleeping for ${delayTime} ms`);
  return new Promise((resolve) => setTimeout(resolve, delayTime));
}

async function checkSettings() {
  console.info("Checking if all necessary settings are present");
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
  if (!SUPPORTED_ASSET_TYPES.includes(process.env.ASSET_TYPE!)) {
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
