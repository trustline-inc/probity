import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function fundFlr(owner: SignerWithAddress, to: string) {
  return owner.sendTransaction({
    to,
    value: ethers.utils.parseEther("10000.0"),
  });
}

export default fundFlr;
