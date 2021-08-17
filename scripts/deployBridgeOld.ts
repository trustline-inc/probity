import "@nomiclabs/hardhat-ethers";
import { deployBridgeOldSystem } from "../lib/deploy";
import * as fs from "fs";

async function main() {
  const { contracts, signers } = await deployBridgeOldSystem();
  console.log("Contracts deployed!");

  const addresses = [];
  let fileOutput = "";
  const contractToChecks = ["aurei", "bridgeOld"];
  for (let contract in contracts) {
    if (!contractToChecks.includes(contract)) continue;
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
