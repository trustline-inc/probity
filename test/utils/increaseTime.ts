import { ethers } from "hardhat";

async function increaseTime(timeToIncreaseInSeconds: number) {
  await ethers.provider.send("evm_increaseTime", [timeToIncreaseInSeconds]);
  await ethers.provider.send("evm_mine", []);
}

export default increaseTime;
