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

  // Address
  const address = "0x901F2B246e5445f9f7317Ee05A14193839E7397C";

  try {
    const args = [
      ethers.utils.formatBytes32String("whitelisted"),
      address,
      false,
      { gasLimit: 300000 },
    ];
    await registry.callStatic.register(...args);
    const result = await registry.register(...args);

    await result.wait();

    console.log(`Successfully whitelisted ${address} on ${hre.network.name}!`);
  } catch (error) {
    console.log(error);
  }
};

init();
