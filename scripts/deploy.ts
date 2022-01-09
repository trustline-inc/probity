import "@nomiclabs/hardhat-ethers";
import { deployDev, Deployment, deployProd } from "../lib/deployer";
import * as fs from "fs";
import * as hre from "hardhat";

async function main() {
  let deployment: Deployment;
  let idempotent: boolean;
  idempotent = false;

  const stablecoin: string = process.env.STABLECOIN
    ? process.env.STABLECOIN.toUpperCase()
    : "AUR";
  if (!["PHI", "AUR"].includes(stablecoin))
    throw Error('STABLECOIN envvar must be set to "PHI" or "AUR".');
    
  if (process.env.IDEMPOTENT === "true") {
    console.info("deploying idempotently");
    idempotent = true;
  }

  if (["local", "internal"].includes(hre.network.name)) {
    console.info("Deploying in Dev Mode");
    deployment = await deployDev(stablecoin, idempotent);
  } else {
    console.info("Deploying in Production Mode");
    deployment = await deployProd(stablecoin, idempotent);
    console.warn(
      "This deployment of Probity in Production does not include ERC20Token, VPToken and Auctioneer contracts. Please deploy them separately."
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
