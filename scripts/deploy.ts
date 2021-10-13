import "@nomiclabs/hardhat-ethers";
import { deployAll } from "../lib/deployer";
import * as fs from "fs";

async function main() {
  if (!process.env.FLARE_DIR)
    throw Error("Please set FLARE_DIR to your local Flare directory.");
  const { contracts } = await deployAll();
  console.log("Contracts deployed!");

  const addresses = [];
  let fileOutput = "";
  for (let contract in contracts) {
    // Convert contract identifiers from PascalCase to UPPER_CASE
    const contractDisplayName = contract
      .split(/(?=[A-Z])/)
      .join("_")
      .toUpperCase();
    console.log(contract);
    console.log(contracts[contract]);
    addresses.push({
      Contract: contractDisplayName,
      Address: contracts[contract].address,
    });
    fileOutput += `${contractDisplayName}=${contracts[contract].address}\n`;
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
