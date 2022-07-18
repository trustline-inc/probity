import "@nomiclabs/hardhat-ethers";
import { probity } from "../lib/deployer";
import * as fs from "fs";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  const erc20 =
    process.env.ERC20 || "0x60f8E563a7A1Ba3D62136f551E9169B3143C7672";
  const assetName = process.env.ASSET_NAME || "USD";

  if (
    !erc20 ||
    !process.env.VAULT_ENGINE ||
    !process.env.REGISTRY ||
    !assetName
  ) {
    console.error(
      "Please provide ERC20, ASSET_NAME, VAULT_ENGINE, and REGISTRY contract addresses in .env"
    );
    process.exit(1);
  }
  const registry = await ethers.getContractAt(
    "Registry",
    process.env.REGISTRY,
    owner
  );

  const param = {
    registry: registry.address,
    vaultEngine: process.env.VAULT_ENGINE,
    symbol: assetName,
    erc20: erc20,
  };

  //@ts-ignore
  let contracts = await probity.deployErc20AssetManager(param);

  console.log("Contracts deployed!");

  const addresses: any[] = [];
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
