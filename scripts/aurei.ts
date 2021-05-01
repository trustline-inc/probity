import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
const aureiContractAbi = require("../artifacts/contracts/Aurei.sol/Aurei.json");
const bridgeContractAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const aureiContractAddress = "0x32dfE359aa1E100Ba8CfBF5f38BcBdb3f55e8a06";
const bridgeContractAddress = "0xb6f0184c26DBDe79E19325259f79f8eB0B07aAD6";
const receiverXrpAddress = "rNeVJZtx4HxgTjT41VVPW3VPHJSz3Gf38R";

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
    bridgeContractAddress,
    bridgeContractAbi.abi,
    owner
  );
  const aureiContract = new ethers.Contract(
    aureiContractAddress,
    aureiContractAbi.abi,
    owner
  );

  // fund 3000000 Aurei to personal address
  await aureiContract.mint(personal.address, 3000000);
  await sleep(5000);

  // increase allowance from owner to the bridgeContract
  const aureiContractPersonal = aureiContract.connect(personal);
  await aureiContractPersonal.increaseAllowance(bridgeContract.address, 30);
  await sleep(5000);

  // check allowance
  const allowance = (
    await aureiContract.allowance(personal.address, bridgeContract.address)
  ).toNumber();
  console.log("bridge contract allowance:", allowance);

  // transfer the aurei to the xrpl
  const bridgeContractPersonal = bridgeContract.connect(personal);
  const nonce = Math.floor(Date.now() / 1000);
  await bridgeContractPersonal.transferAureiToXRP(xrpAddress, 30, nonce);
  await sleep(5000);

  // check for transfers
  console.log(
    "xrp transfers:",
    await bridgeContractPersonal.getToXRPTransferHashes()
  );
  await sleep(5000);

  // get tx hash from above and pass in below
  // console.log(await bridgeContractPersonal.toXRPTransfers('0x4a22e9451ec0365fe33cf0ee7eaaad063cc014b2beeef61c80714784dfa34eb5'))
  // console.log((await aureiContract.allowance(personal.address, bridgeContract.address)).toNumber())
}
main(receiverXrpAddress);