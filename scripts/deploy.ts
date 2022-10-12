import "@nomiclabs/hardhat-ethers";
import { utils } from "ethers";
import { deployDev, Deployment, deployProd } from "../lib/deployer";
import * as fs from "fs";
import * as hre from "hardhat";

utils.Logger.setLogLevel(utils.Logger.levels.ERROR);

async function main() {
  let deployment: Deployment;
  if (["localhost", "local", "internal"].includes(hre.network.name)) {
    console.info("Deploying in Dev Mode");
    deployment = await deployDev();
  } else {
    console.info("Deploying in Production Mode");
    deployment = await deployProd();
    console.warn(
      "This deployment of Probity in Production does not include ERC20AssetManager, VPAssetManager and Auctioneer contracts. Please deploy them separately."
    );
  }

  let { contracts } = deployment;

  console.log("Contracts deployed!");

  const addresses: any[] = [];
  let fileOutput = "";
  for (let contractName in contracts) {
    if (contracts[contractName] == null) continue;

    let contractAddress =
      typeof contracts[contractName] === "string"
        ? contracts[contractName]
        : contracts[contractName].address;

    // Convert contract identifiers from camelCase to UPPER_SNAKE_CASE
    let contractDisplayName = contractName
      .split(/(?=[A-Z])/)
      .join("_")
      .toUpperCase();

    if (contractName === "erc20") {
      const contract = contracts[contractName];
      if (typeof contract!["USD"] !== "undefined") {
        contractAddress = contract!["USD"].address;
        contractDisplayName = "USD";
      } else if (typeof contract!["FXRP"] !== "undefined") {
        contractAddress = contract!["FXRP"].address;
        contractDisplayName = "FXRP";
      } else if (typeof contract!["UPXAU"] !== "undefined") {
        contractAddress = contract!["UPXAU"].address;
        contractDisplayName = "UPXAU";
      }
      if (contractDisplayName === "ERC20") continue; // skip empty ERC20
    }

    if (contractName === "erc20AssetManager") {
      const contract = contracts[contractName];
      if (typeof contract!["USD_MANAGER"] !== "undefined") {
        contractAddress = contract!["USD_MANAGER"].address;
        contractDisplayName = "USD_MANAGER";
      } else if (typeof contract!["FXRP_MANAGER"] !== "undefined") {
        contractAddress = contract!["FXRP_MANAGER"].address;
        contractDisplayName = "FXRP_MANAGER";
      } else if (typeof contract!["UPXAU_MANAGER"] !== "undefined") {
        contractAddress = contract!["UPXAU_MANAGER"].address;
        contractDisplayName = "UPXAU_MANAGER";
      }
      if (contractDisplayName === "ERC20_ASSET_MANAGER") continue; // skip empty ERC20_ASSET_MANAGER
    }

    addresses.push({
      Contract: contractDisplayName,
      Address: contractAddress,
    });

    fileOutput += `${contractDisplayName}=${contractAddress}\n`;
  }

  console.table(addresses);
  fs.writeFileSync(".env", fileOutput);
  console.info(`Contract addresses written to ${process.cwd()}/.env`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
