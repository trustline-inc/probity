require("dotenv").config();
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  defaultNetwork: "coston",
  networks: {
    coston: {
      url: "https://coston.trustline.co/ext/bc/C/rpc",
      accounts: [],
      chainId: 16,
    },
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
    },
    local: {
      url: "http://127.0.0.1:9650/ext/bc/C/rpc",
      accounts: [
        "44b8de040dec19cf810efe64919b481e05e2ba643efe003223662f1626b114f0",
        "d77b743a0b9170c230e4a4be446b8605aa45f1d00da3d8cd5e5f778c287e1f22",
      ],
      chainId: 16,
    },
  },
  solidity: "0.8.4",
};

export default config;
