import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

const init = async () => {
  // Wallets
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  // ABIs
  const RegistryABI = await artifacts.readArtifact("Registry");

  // Contracts
  const registry = new ethers.Contract(
    process.env.REGISTRY!,
    RegistryABI.abi,
    owner
  );

  try {
    const args = [
      ethers.utils.formatBytes32String("whitelisted"),
      "0x11EeB875AAc42eEe7CB37668360206B0056F6eEd",
      false,
      { gasLimit: 300000 },
    ];
    await registry.callStatic.setupAddress(...args);
    const result = await registry.setupAddress(...args);

    await result.wait();
  } catch (error) {
    console.log(error);
  }
};

init();
