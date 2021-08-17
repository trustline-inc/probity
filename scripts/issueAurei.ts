import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const aureiContractAbi = require("../artifacts/contracts/probity/tokens/Aurei.old.sol/Aurei.json");
const bridgeContractAbi = require("../artifacts/contracts/old/Bridge.old.sol/BridgeOld.json");
const receiverXrpAddress = "rpBMYKXSpwjXmD2qkx1DnzxnCSRVoM5zM2";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @function main
 * @param xrpAddress
 */
async function main(xrpAddress: string) {
  let owner: SignerWithAddress;
  let personal: SignerWithAddress;
  [owner, personal] = await ethers.getSigners();

  const bridgeContract = new ethers.Contract(
    process.env.BRIDGEOLD,
    bridgeContractAbi.abi,
    owner
  );
  const aureiContract = new ethers.Contract(
    process.env.AUREI,
    aureiContractAbi.abi,
    owner
  );

  const amountToMint = "100000000000000000";
  const amount = "3200000000000000";

  // fund 100 Aurei to personal address
  await aureiContract.mint(personal.address, amountToMint, {
    gasPrice: 1000000000000,
  });
  await sleep(5000);

  // increase allowance from owner to the bridgeContract
  const aureiContractPersonal = aureiContract.connect(personal);
  await aureiContractPersonal.increaseAllowance(bridgeContract.address, amount);
  await sleep(5000);

  // check allowance
  const allowance = (
    await aureiContract.allowance(personal.address, bridgeContract.address)
  ).toNumber();
  console.log("Bridge contract allowance:", allowance);

  // transfer the aurei to the xrpl

  console.log(`Sumitting ${amount} Aurei to Bridge contract.`);
  console.log(`Receiving address: ${xrpAddress}`);
  const bridgeContractPersonal = bridgeContract.connect(personal);
  const nonce = Math.floor(Date.now() / 1000);
  await bridgeContractPersonal.transferAureiToXRP(xrpAddress, amount, nonce);
  await sleep(5000);

  const hash = await bridgeContractPersonal.calculateTxHash(
    xrpAddress,
    amount,
    nonce
  );
  console.log("Tx Hash:", hash);

  // check for transfers
  console.log(
    "XRP transfers:",
    await bridgeContractPersonal.getToXRPTransferHashes()
  );
  await sleep(5000);

  // get tx hash from above and pass in below
  // console.log(await bridgeContractPersonal.toXRPTransfers('0x4a22e9451ec0365fe33cf0ee7eaaad063cc014b2beeef61c80714784dfa34eb5'))
}
main(receiverXrpAddress);
