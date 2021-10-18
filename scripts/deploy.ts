import "@nomiclabs/hardhat-ethers";
import { deployLocal, deployProd, probity } from "../lib/deployer";
import * as fs from "fs";

async function main() {
  let deployed;
  if (process.env.NETWORK === "local") {
    console.log("Deploying in Local Mode");
    deployed = await deployLocal();
  } else {
    console.log("Deploying in Production Mode");
    deployed = await deployProd();
    console.log(
      "Warning: this deployment of Probity in Production does not include ERC20Collateral, VPTokenCollateral and Auction please deploy them separately"
    );
  }

  let { contracts } = deployed;

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

  fs.writeFileSync(".env", fileOutput);
  console.table(addresses);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
