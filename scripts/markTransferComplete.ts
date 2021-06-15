import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
const bridgeContractAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const bridgeContractAddress = "0xa8Cb9E99a22D49fb0C2944a9C23977007041e148";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @function main
 * @param xrpAddress
 */
async function main() {
  let owner: SignerWithAddress;
  [owner] = await ethers.getSigners();

  const txHashes = [
    "0xab9be1ebf6cab3fa08c735c60c49123226d87e930db1614fb57ad8262cbc9e71",
    "0x59c6ece4a30b86fe2000111ecb9a0ab29fe98db044b0b57851fe54fa2580372c",
  ];

  const bridgeContract = new ethers.Contract(
    bridgeContractAddress,
    bridgeContractAbi.abi,
    owner
  );

  for (let txHash of txHashes) {
    await bridgeContract.updateTransferStatus(txHash, "Cancelled", 2);
    await sleep(5000);

    // check for transfers
    console.log(
      "Checking Transfer with hash : " + txHash + "\n",
      await bridgeContract.toXRPTransfers(txHash),
      "\n"
    );
    await sleep(5000);
  }
}
main();
