import { ethers } from "hardhat";

async function increaseTime(timeToIncreaseInSecond) {
  await ethers.provider.send("evm_increaseTime", [timeToIncreaseInSecond]);
  await ethers.provider.send("evm_mine", []);
}

export default increaseTime;
