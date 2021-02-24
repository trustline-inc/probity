import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Aurei contract", function() {
  it("It should work", async function() {
    const AureiFactory = await ethers.getContractFactory("Aurei");

    const Aurei = await AureiFactory.deploy();
  });
});