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
    process.env.REGISTRY,
    RegistryABI.abi,
    owner
  );

  try {
    await registry.callStatic.setupAddress(
      ethers.utils.formatBytes32String("whitelisted"),
      "0x32742a70453f97e933C8D623a9bA14dFAE8B49fC",
      { gasLimit: 300000 }
    );
    const result = await registry.setupAddress(
      ethers.utils.formatBytes32String("whitelisted"),
      "0x32742a70453f97e933C8D623a9bA14dFAE8B49fC",
      { gasLimit: 300000 }
    );

    await result.wait();
  } catch (error) {
    console.log(error);
  }
};

init();
