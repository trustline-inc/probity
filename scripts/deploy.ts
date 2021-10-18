import "@nomiclabs/hardhat-ethers";
import { deployLocal, deployProd, probity } from "../lib/deployer";
import * as fs from "fs";

async function main() {
  let deployed;
  if (process.env.NETWORK === "local") {
    console.log("Deploying Locally");
    deployed = await deployLocal();
  } else {
    if (process.argv[2] == "ERC20Collateral") {
      if (
        !process.argv[3] ||
        !process.env.VAULT_ENGINE ||
        !process.env.REGISTRY
      ) {
        console.error(
          "Please provide erc20 address for the collateral contract and make sure the .env have current contract addresses"
        );
        process.exit(1);
      }
      const param = {
        registry: process.env.REGISTRY,
        vaultEngine: process.env.VAULT_ENGINE,
        erc20: process.argv[3],
      };
      deployed = await probity.deployERC20Collateral(param);
    } else if (process.argv[2] == "VPTokenCollateral") {
      if (
        !process.argv[3] ||
        !process.argv[4] ||
        !process.argv[5] ||
        !process.env.VAULT_ENGINE ||
        !process.env.REGISTRY
      ) {
        console.error(
          "Please provide vpToken, ftsoManager and ftsoRewardManager addresses for the collateral contract and make sure the .env have current contract addresses "
        );
        process.exit(1);
      }
      const param = {
        registry: process.env.REGISTRY,
        vaultEngine: process.env.VAULT_ENGINE,
        vpToken: process.argv[3],
        ftsoManager: process.argv[4],
        ftsoRewardManager: process.argv[5],
      };
      deployed = await probity.deployVPTokenCollateral(param);
    } else if (process.argv[2] == "Auction") {
      if (
        !process.argv[3] ||
        !process.env.LINEAR_DECREASE ||
        !process.env.VAULT_ENGINE ||
        !process.env.REGISTRY
      ) {
        console.error(
          "Please provide ftso address for the auction contract and make sure the .env have current contract addresses "
        );
        process.exit(1);
      }
      const param = {
        registry: process.env.REGISTRY,
        vaultEngine: process.env.VAULT_ENGINE,
        vpToken: process.argv[3],
        ftsoManager: process.argv[4],
        ftsoRewardManager: process.argv[5],
      };
      deployed = await probity.deployVPTokenCollateral(param);
    } else {
      deployed = await deployProd();
      console.log(
        "Warning: this deployment of Probity in Production does not include ERC20Collateral, VPTokenCollateral and Auction please deploy them separately"
      );
    }
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
