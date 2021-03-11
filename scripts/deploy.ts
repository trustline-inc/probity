import "@nomiclabs/hardhat-ethers";
import deploy from "../lib/deploy";

async function main() {
  const { contracts, signers } = await deploy();
  console.log("Contracts deployed!");
  console.log("===================");

  for (let contract in contracts) {
    console.log(contract, contracts[contract].address);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
