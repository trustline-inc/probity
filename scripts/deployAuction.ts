import "@nomiclabs/hardhat-ethers";
import { probity } from "../lib/deployer";
import * as fs from "fs";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  if (
    !process.env.ERC20 ||
    !process.env.LINEAR_DECREASE ||
    !process.env.VAULT_ENGINE ||
    !process.env.REGISTRY
  ) {
    console.error(
      "Please provide FTSO, LINEAR_DECREASE, VAULT_ENGINE and REGISTRY contract addresses in .env"
    );
    process.exit(1);
  }
  const registry = await ethers.getContractAt(
    "Registry",
    process.env.REGISTRY,
    owner
  );

  const param = {
    registry,
    vaultEngine: process.env.VAULT_ENGINE,
    priceCalc: process.env.LINEAR_DECREASE,
    ftso: process.env.FTSO,
  };

  //@ts-ignore
  let contracts = await probity.deployAuction(param);

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

  fs.appendFileSync(".env", fileOutput);
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
