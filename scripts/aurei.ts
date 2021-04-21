import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";

const bridgeContractAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const aureiContractAbi = require("../artifacts/contracts/Aurei.sol/Aurei.json");

const bridgeContractAddress = "0x3E3578908883aff83F46d001a2c2b8A4fE3782e5";
const aureiContractAddress = "0x1be91Ab0e8D679985086CE9AC493A02f92FB3FE2";

async function main(xrpAddress) {
  let owner: SignerWithAddress;
  [owner] = await ethers.getSigners();

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

  // fund 100 Aurei to ownerAddress
  await aureiContract.mint(owner.address, 3000000);

  // increase allowance from owner to the bridgeContract
  await aureiContract.increaseAllowance(bridgeContract.address, 3000000);

  // timestamp now in seconds
  const nonce = Math.floor(Date.now() / 1000);
  await bridgeContract.transferAureiToXRP(xrpAddress, 3000000, nonce);
}

main("rpP1zrii6LGidTtLpgz8Xtx9mHi35LzMEL");
