import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const aureiContractAbi = require("../artifacts/contracts/Aurei.sol/Aurei.json");
const bridgeContractAbi = require("../artifacts/contracts/old/Bridge.old.sol/BridgeOld.json");
const receiverXrpAddress = "rHz3vF67zTdMGtcCeEjxP6JbracH6RSZy6";

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
    process.env.BRIDGE,
    bridgeContractAbi.abi,
    owner
  );
  const aureiContract = new ethers.Contract(
    process.env.AUREI,
    aureiContractAbi.abi,
    owner
  );

  let res = await aureiContract.balanceOf(bridgeContract.address);
  console.log(res.toString());

  const amount = ethers.utils.parseEther("0.00442");
  // fund 100 Aurei to personal address
  await aureiContract.mint(personal.address, amount, {
    gasPrice: 1000000000000,
  });
  await sleep(5000);
  console.log("here");

  console.log((await aureiContract.balanceOf(personal.address)).toString());

  // increase allowance from owner to the bridgeContract
  const aureiContractPersonal = aureiContract.connect(personal);
  await aureiContractPersonal.increaseAllowance(bridgeContract.address, amount);
  await sleep(5000);
  console.log("here");

  console.log((await aureiContract.balanceOf(personal.address)).toString());

  // check allowance
  const allowance = (
    await aureiContract.allowance(personal.address, bridgeContract.address)
  ).toString();
  console.log("Bridge contract allowance:", allowance);
  console.log("here");
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
  res = await aureiContract.balanceOf(bridgeContract.address);
  console.log(res.toString());

  // get tx hash from above and pass in below
  // console.log(await bridgeContractPersonal.toXRPTransfers('0x4a22e9451ec0365fe33cf0ee7eaaad063cc014b2beeef61c80714784dfa34eb5'))
}
main(receiverXrpAddress);
