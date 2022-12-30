/**
 * This script deploys a new asset manager contract and initialize the asset in the system
 * Usage: Configure environment variables before running.
 *
 * Required environment variables:
 *   - REGISTRY
 *   - VAULT_ENGINE
 *   - PRICE_FEED
 *   - TELLER
 *   - LIQUIDATOR
 *   - FTSO (if DEPLOY_FTSO=false)
 *   - ERC20 (if ASSET_TYPE=ERC20)
 *   - FTSO_MANAGER (if ASSET_TYPE=VPToken)
 *   - FTSO_REWARD_MANAGER (if ASSET_TYPE=VPToken)
 *   - VP_TOKEN (if ASSET_TYPE=VPToken)
 */

import "@nomiclabs/hardhat-ethers";
import {
  probity,
  mock,
  parseExistingContracts,
  contracts,
} from "../lib/deployer";
import { ethers, web3 } from "hardhat";
import { ADDRESS_ZERO } from "../test/utils/constants";

// Only log errors
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

// Configuration
const ASSET_ADDRESS = "0xedf9ED79889896D90f7C76b9FCaB6970fBc5626b";
const ASSET_NAME = "LQO";
const ASSET_TYPE = "ERC20";
const DEPLOY_FTSO = true;
const LIQUIDATION_RATIO = 3;
const PROTOCOL_FEE = 0.05;
const DEPLOYMENT_DELAY = 0;
const DELAY = 0;

/**
 * @function main
 */
async function main() {
  const contractsToCheck = [
    "REGISTRY",
    "VAULT_ENGINE",
    "PRICE_FEED",
    "TELLER",
    "LIQUIDATOR",
  ];

  await checkContractAddresses(contractsToCheck);
  await checkSettings();
  contracts = await parseExistingContracts(contracts);

  // deploy the new asset manager contract(s)
  console.info("Deploying Asset Manager");
  switch (ASSET_TYPE) {
    case "Native":
      contracts = await probity.deployNativeAssetManager({
        registry: process.env.REGISTRY,
        assetId,
        vaultEngine: process.env.VAULT_ENGINE,
      });
      break;
    case "ERC20":
      if (!ASSET_ADDRESS)
        logErrorAndExit(`Please set the ASSET_ADDRESS variable in the script`);

      // TODO: fix deployErc20AssetManager erasing ftso address
      if (contracts.ftso) var temp = contracts.ftso;

      // we need erc20 address
      const params = {
        registry: process.env.REGISTRY,
        vaultEngine: process.env.VAULT_ENGINE,
        symbol: ASSET_NAME,
        erc20: ASSET_ADDRESS,
      };
      contracts = await probity.deployErc20AssetManager(params);
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

  // deploy FTSO if needed
  if (DEPLOY_FTSO) {
    console.info(`Deploying Mock FTSO for ${ASSET_NAME}`);
    const deployed = await mock.deployMockFtso(ASSET_NAME);

    ftso = deployed!.ftso[ASSET_NAME]?.address;
  } else {
    console.info("Skipping FTSO deployment");
    ftso = contracts.ftso[ASSET_NAME]?.address;
  }

  // deploy Auctioneer
  console.info("Deploying Auctioneer");
  await probity.deployAuctioneer();

  // ASSET_NAME is the asset symbol
  const assetId = web3.utils.keccak256(ASSET_NAME!);

  const category = 3; // category for both assets is 3
  await execute(
    contracts.vaultEngine.initAsset(assetId, category, { gasLimit: 300000 }),
    "Initializing asset on VaultEngine"
  );

  // Change param `ADDRESS_ZERO` if the asset has a VPAssetManager address
  await execute(
    contracts.liquidator.initAsset(
      assetId,
      contracts.auctioneer.address,
      ADDRESS_ZERO,
      {
        gasLimit: 300000,
      }
    ),
    "Initializing asset on Liquidator"
  );

  await execute(
    contracts.priceFeed.initAsset(
      assetId,
      ethers.utils.parseEther(String(LIQUIDATION_RATIO)),
      ftso,
      { gasLimit: 300000 }
    ),
    "Initializing asset on PriceFeed"
  );

  await execute(
    contracts.priceFeed.updateAdjustedPrice(assetId, { gasLimit: 300000 }),
    "Updating adjusted price on PriceFeed"
  );
}

/**
 * @function checkContractAddresses
 * @param contractNames
 */
async function checkContractAddresses(contractNames) {
  console.info("Checking if necessary contract addresses are present");
  for (let contractName of contractNames) {
    if (process.env[contractName] === undefined) {
      logErrorAndExit(
        `Missing contract address for ${contractName}, please set it in env variable`
      );
    }
  }
}

/**
 * @function execute
 * @param promise
 * @param message
 */
async function execute(promise, message) {
  console.info(message);
  await promise;
  await checkDelay();
}

/**
 * @function checkDelay
 * @returns
 */
async function checkDelay() {
  if (DELAY === undefined) return;
  const delayTime = parseInt(DELAY);
  console.log(`sleeping for ${delayTime} ms`);
  return new Promise((resolve) => setTimeout(resolve, delayTime));
}

/**
 * @function checkSettings
 */
async function checkSettings() {
  console.info("Checking if all necessary settings are present");
  const SUPPORTED_ASSET_TYPES = ["Native", "VPToken", "ERC20"];

  // ASSET_TYPE
  if (!SUPPORTED_ASSET_TYPES?.includes(ASSET_TYPE!)) {
    logErrorAndExit(
      `Please provide a supported ASSET_TYPE (Native, VPToken, ERC20)`
    );
  }

  // DEPLOY_FTSO
  if (!DEPLOY_FTSO && process.env[`${ASSET_NAME}_FTSO`] === undefined) {
    logErrorAndExit(`FTSO address is needed when DEPLOY_FTSO=false`);
  }
}

/**
 * @function logErrorAndExit
 * @param message
 */
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
