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
  if (process.env.DEPLOY_FTSO) {
    console.info("Deploying Mock FTSO");
    const deployed = await mock.deployMockFtso();
    ftso = deployed.ftso.address;
  } else {
    console.info("Skipping Deploying FTSO");
    ftso = contracts.ftso.address;
  }

  // deploy Auctioneer
  console.info("Deploying Auctioneer");
  await probity.deployAuctioneer();

  console.info("Initializing Asset on VaultEngine");
  await contracts.vaultEngine.initAsset(assetId);

  console.info("Initializing Asset on teller");
  await contracts.teller.initAsset(
    assetId,
    ethers.utils.parseEther(process.env.LIQUIDATION_RATIO)
  );

  console.info("Initializing Asset on liquidator");
  await contracts.liquidator.MockVPToken(assetId, contracts.auctioneer.address);

  console.info("Initializing Asset on priceFeed");
  await contracts.priceFeed.MockVPToken(
    assetId,
    ethers.utils.parseEther(process.env.LIQUIDATION_RATIO),
    ftso
  );

  console.info("Updating Adjusted Price on priceFeed");
  await contracts.priceFeed.updateAdjustedPrice(assetId);
}

async function checkContractAddresses(contractNames) {
  console.info("Checking if necessary contract addresses are present");
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
