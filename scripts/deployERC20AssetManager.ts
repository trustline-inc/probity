import "@nomiclabs/hardhat-ethers";
import { probity } from "../lib/deployer";
import * as fs from "fs";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const bytes32 = (string: string) => ethers.utils.formatBytes32String(string);

async function main() {
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  const erc20 =
    process.env.ERC20 || "0x60f8E563a7A1Ba3D62136f551E9169B3143C7672";
  const symbol = process.env.ASSET_NAME || "USD";

  if (!erc20 || !process.env.VAULT_ENGINE || !process.env.REGISTRY || !symbol) {
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
    symbol: symbol,
    erc20: erc20,
    vaultEngine: process.env.VAULT_ENGINE,
  };

  //@ts-ignore
  let contracts = await probity.deployErc20AssetManager(param);

  console.log("Contracts deployed!");

  const addresses: any[] = [];
  let fileOutput = "";
  for (let contractName in contracts) {
    if (contracts[contractName] == null) continue;
    // Convert contract identifiers from PascalCase to UPPER_CASE
    let contractDisplayName = contractName
      .split(/(?=[A-Z])/)
      .join("_")
      .toUpperCase();

    let contractAddress = contracts[contractName].address;

    if (contractName === "erc20") {
      const contract = contracts[contractName];
      if (typeof contract!["USD"] !== "undefined") {
        contractAddress = contract!["USD"].address;
        contractDisplayName = "USD";
      } else if (typeof contract!["LQO"] !== "undefined") {
        contractAddress = contract!["LQO"].address;
        contractDisplayName = "LQO";
      }
      if (contractDisplayName === "ERC20") continue; // skip empty ERC20
    }

    if (contractName === "erc20AssetManager") {
      const contract = contracts[contractName];
      if (typeof contract!["USD_MANAGER"] !== "undefined") {
        contractAddress = contract!["USD_MANAGER"].address;
        contractDisplayName = "USD_MANAGER";
      } else if (typeof contract!["LQO_MANAGER"] !== "undefined") {
        contractAddress = contract!["LQO_MANAGER"].address;
        contractDisplayName = "LQO_MANAGER";
      }
      if (contractDisplayName === "ERC20_ASSET_MANAGER") continue; // skip empty ERC20_ASSET_MANAGER
    }

    addresses.push({
      Contract: contractDisplayName,
      Address: contractAddress,
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
