import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
const aureiContractAbi = require("../artifacts/contracts/Aurei.sol/Aurei.json");
const bridgeContractAbi = require("../artifacts/contracts/Bridge.sol/Bridge.json");
const aureiContractAddress = "0x82756dc5c3a74422C1a95227e9A8832e33C337cb";
const bridgeContractAddress = "0xb6f0184c26DBDe79E19325259f79f8eB0B07aAD6";
const flareRedemptionAddress = "0xffC11262622D5069aBad729efe84a95C169d9c06";

/**
 * @function main
 * @param flareAddress
 */
async function main(flareAddress: string) {
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

  setInterval(async () => {
    const balance = (
      await aureiContract.balanceOf(personal.address)
    ).toNumber();
    console.log(
      "Aurei balance for address " + flareRedemptionAddress + ":",
      balance
    );
  }, 5000);
}
main(flareRedemptionAddress);
