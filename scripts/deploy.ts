import "@nomiclabs/hardhat-ethers";
import deploy from "../lib/deploy";
import * as fs from "fs";

async function main() {
  const { contracts, signers } = await deploy();
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
