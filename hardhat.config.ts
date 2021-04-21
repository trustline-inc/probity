require("dotenv").config();
import "hardhat-typechain";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  defaultNetwork: "coston",
  networks: {
    coston: {
      url: "https://coston.flare.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 16,
    },
    hardhat: {
      chainId: 1337,
    },
    flare_local: {
      url: "http://127.0.0.1:9650/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },
    trustline: {
      url: "https://coston.trustline.co/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  solidity: "0.8.0",
};

export default config;
