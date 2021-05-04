import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
const aureiContractAbi = require("../artifacts/contracts/Aurei.sol/Aurei.json");
const bridgeContractAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const aureiContractAddress = "0xeb47A5C561b40057733B38B5839EF7efCdE25860";
const bridgeContractAddress = "0x2B305335521dB459B16a7954bcb61d7a1807B46d";
const receiverXrpAddress = "rsBMHhHiDj2FAvhaCdAtc3wzic6vgyzrm6";

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

  // fund 100 Aurei to personal address
  await aureiContract.mint(personal.address, 100, {
    gasPrice: 1000000000000,
  });
  await sleep(5000);

  // increase allowance from owner to the bridgeContract
  const aureiContractPersonal = aureiContract.connect(personal);
  await aureiContractPersonal.increaseAllowance(bridgeContract.address, 30);
  await sleep(5000);

  // check allowance
  const allowance = (
    await aureiContract.allowance(personal.address, bridgeContract.address)
  ).toNumber();
  console.log("Bridge contract allowance:", allowance);

  // transfer the aurei to the xrpl
  const amount = 30;
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
