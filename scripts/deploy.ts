import "@nomiclabs/hardhat-ethers";
import { deployAll } from "../lib/deploy";
import * as fs from "fs";

async function main() {
  if (!process.env.FLARE_DIR)
    throw Error("Please set FLARE_DIR to your local Flare directory.");

  const { contracts, signers } = await deployAll();
  console.log("Contracts deployed!");

  const addresses = [];
  let fileOutput = "";
  for (let contract in contracts) {
    addresses.push({
      Contract: contract.toUpperCase(),
      Address: contracts[contract].address,
    });
    fileOutput += `${contract.toUpperCase()}=${contracts[contract].address}\n`;
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
