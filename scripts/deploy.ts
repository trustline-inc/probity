import "@nomiclabs/hardhat-ethers";
import { utils } from "ethers";
import { deployDev, Deployment, deployProd } from "../lib/deployer";
import * as fs from "fs";
import * as hre from "hardhat";

utils.Logger.setLogLevel(utils.Logger.levels.ERROR);

async function main() {
  let deployment: Deployment;

  if (["local", "internal"].includes(hre.network.name)) {
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

  const addresses = [];
  let fileOutput = "";
  for (let contractName in contracts) {
    if (contracts[contractName] == null) continue;
    // Convert contract identifiers from PascalCase to UPPER_CASE
    const contractDisplayName = contractName
      .split(/(?=[A-Z])/)
      .join("_")
      .toUpperCase();
    let contractAddress =
      typeof contracts[contractName] === "string"
        ? contracts[contractName]
        : contracts[contractName].address;
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
