import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const bridgeContractAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchIncompleteTransfers(bridgeContract: any) {
  const res = await bridgeContract.getToXRPTransferHashes();

  const output = {
    pending: [] as any[],
    inProgress: [] as any[],
  };

  for (const txHash of res) {
    const transfer = await bridgeContract.toXRPTransfers(txHash);

    let amount = transfer[2];
    const status = transfer[5];

    if (amount.toString() === "0" || status === 2) continue;
    console.log(txHash, transfer);
    const entry = {
      txHash,
      destination: transfer[1],
      amount: parseFloat(amount),
      nonce: transfer[3],
      txIdOnXRP: transfer[4],
      status: transfer[5],
    };

    if (transfer[5] === "0") {
      output.pending.push(entry);
    } else if (transfer[5] === "1") {
      output.inProgress.push(entry);
    }
  }

  return output;
}

/**
 * @function main
 * @param xrpAddress
 */
async function main() {
  let owner: SignerWithAddress;
  [owner] = await ethers.getSigners();

  const txHashes = [
    "0x6c37fed5a04f90e11eb2633fd03318ec8eea59cb9905c91dc765c17574a35984",
    "0x52473939709c67d7522d6e46ca0db4dad5dfa39a606c022caffc27f4af2355a3",
  ];

  const bridgeContract = new ethers.Contract(
    process.env.BRIDGE,
    bridgeContractAbi.abi,
    owner
  );
  // const output = await fetchIncompleteTransfers(bridgeContract)
  // console.log(output)
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
