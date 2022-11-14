import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import * as dotenv from "dotenv";
import * as hre from "hardhat";
import { parseExistingContracts } from "../lib/deployer";
import { bytes32 } from "../test/utils/constants";

dotenv.config();

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

/**
 * Initialize the system into a ready state
 */
const init = async () => {
  const contracts = await parseExistingContracts();
  // Wallets
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  const contractsToCheck = [
    "priceFeed",
    "vaultEngine",
    "reservePool",
    "teller",
    "treasury",
    "liquidator",
    "bondIssuer",
  ];

  if (contracts.registry == null) {
    throw new Error(`Please provide REGISTRY address in env variables`);
  }

  // first check if the owner is a governance address
  const isGov = await contracts.registry["checkValidity(bytes32,address)"](
    bytes32("admin"),
    owner.address
  );
  if (!isGov) {
    console.error(`Provided address is not "admin" address`);
    process.exit(1);
  }

  // set paused state for all the contracts above
  for (let contractName of contractsToCheck) {
    if (contracts[contractName] == null) {
      throw new Error(
        `Please provide ${contractName.toUpperCase()} address in env variables`
      );
    } else {
      console.log(`Setting paused state for ${contractName}`);
      await contracts[contractName].setState(bytes32("paused"), true);
    }
    // add delay mechnism to avoid issues
    await checkDelay();
  }

  console.log(`Verifying that paused state is set properly`);
  for (let contractName of contractsToCheck) {
    const isPaused = await contracts[contractName].states(bytes32("paused"));
    if (!isPaused) {
      console.error(`${contractName} has failed the paused check`);
      process.exit(1);
    }
  }
  console.log(`Verification successful`);
};

function checkDelay() {
  if (process.env.DELAY === undefined) return;
  const delayTime = parseInt(process.env.DELAY);
  console.log(`sleeping for ${delayTime} ms`);
  return new Promise((resolve) => setTimeout(resolve, delayTime));
}

init();
