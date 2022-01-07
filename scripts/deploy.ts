import "@nomiclabs/hardhat-ethers";
import { deployLocal, Deployment, deployProd } from "../lib/deployer";
import * as fs from "fs";

async function main() {
  let deployment: Deployment;
  let idempotent: boolean;
  idempotent = false;

  const stablecoin: string = process.env.STABLECOIN
    ? process.env.STABLECOIN.toLowerCase()
    : "aurei";
  if (!["phi", "aurei"].includes(stablecoin))
    throw Error('STABLECOIN envvar must be set to "phi" or "aurei".');

  if (process.env.IDEMPOTENT === "true") {
    console.info("deploying idempotently");
    idempotent = true;
  }

  if (process.env.NETWORK === "local") {
    console.info("Deploying in Local Mode");
    deployment = await deployLocal(stablecoin);
  } else {
    console.info("Deploying in Production Mode");
    deployment = await deployProd(stablecoin);
    console.warn(
      "This deployment of Probity in Production does not include ERC20Collateral, VPTokenCollateral and Auctioneer contracts. Please deploy them separately."
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
    addresses.push({
      Contract: contractDisplayName,
      Address: contracts[contractName].address,
    });
    fileOutput += `${contractDisplayName}=${contracts[contractName].address}\n`;
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
