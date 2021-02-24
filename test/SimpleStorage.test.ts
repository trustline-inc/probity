import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Simple storage contract", function() {
  it("Setting storage should work", async function() {
    const SimpleStorageFactory = await ethers.getContractFactory("SimpleStorage");
    const SimpleStorage = await SimpleStorageFactory.deploy();

    const value = 1;
    await SimpleStorage.set(value);
    const response = await SimpleStorage.get()
    expect(response.toNumber()).to.equal(value);
  });
});