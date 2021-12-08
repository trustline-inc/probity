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

  await registry.setupAddress(
    web3.utils.keccak256("whiteListed"),
    "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD",
    { gasLimit: 300000 }
  );
};

init();
