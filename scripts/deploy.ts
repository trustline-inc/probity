import "@nomiclabs/hardhat-ethers";
import { utils } from "ethers";
import { deploy } from "../lib/deployerV2";
import { resetEthernalWorkspace } from "../lib/utils";
import * as fs from "fs";
import * as hre from "hardhat";

utils.Logger.setLogLevel(utils.Logger.levels.ERROR);

async function main() {
  await resetEthernalWorkspace()
  await deploy()
  console.log("Done!")

  // /*
  //  * Write contract deployment addresses to file and display table in console
  //  */
  // const table: ConsoleTableRow[] = [];
  // let fileOutput = "";
  // let { contracts } = deployment;
  // for (let contractName in contracts) {
  //   if (contracts[contractName] == null) continue;

  //   // contracts[contractName] can be a string or an object
  //   let contractAddress =
  //     typeof contracts[contractName] === "string"
  //       ? contracts[contractName]
  //       : contracts[contractName].address;

  //   // Convert contract identifiers from camelCase to UPPER_SNAKE_CASE
  //   let contractDisplayName = contractName
  //     .split(/(?=[A-Z])/)
  //     .join("_")
  //     .toUpperCase();

  //   if (contractName === "erc20") {
  //     const contract = contracts[contractName];
  //     if (typeof contract!["USD"] !== "undefined") {
  //       contractAddress = contract!["USD"].address;
  //       contractDisplayName = "USD";
  //     } else if (typeof contract!["FXRP"] !== "undefined") {
  //       contractAddress = contract!["FXRP"].address;
  //       contractDisplayName = "FXRP";
  //     } else if (typeof contract!["UPXAU"] !== "undefined") {
  //       contractAddress = contract!["UPXAU"].address;
  //       contractDisplayName = "UPXAU";
  //     }
  //     if (contractDisplayName === "ERC20") continue; // skip empty ERC20
  //   }

  //   if (contractName === "erc20AssetManager") {
  //     const contract = contracts[contractName];
  //     if (typeof contract!["USD_MANAGER"] !== "undefined") {
  //       contractAddress = contract!["USD_MANAGER"].address;
  //       contractDisplayName = "USD_MANAGER";
  //     } else if (typeof contract!["FXRP_MANAGER"] !== "undefined") {
  //       contractAddress = contract!["FXRP_MANAGER"].address;
  //       contractDisplayName = "FXRP_MANAGER";
  //     } else if (typeof contract!["UPXAU_MANAGER"] !== "undefined") {
  //       contractAddress = contract!["UPXAU_MANAGER"].address;
  //       contractDisplayName = "UPXAU_MANAGER";
  //     }
  //     if (contractDisplayName === "ERC20_ASSET_MANAGER") continue; // skip empty ERC20_ASSET_MANAGER
  //   }

  //   table.push({
  //     "Contract Name": contractDisplayName,
  //     "Contract Address": contractAddress,
  //   });

  //   fileOutput += `${contractDisplayName}=${contractAddress}\n`;
  // }

  // console.table(table);
  // // const filepath = `${process.cwd()}/docs/${hre.network.name}-addresses`
  // const filepath = ".env";
  // fs.writeFileSync(filepath, fileOutput);
  // console.info(`Contract addresses written to ${filepath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
