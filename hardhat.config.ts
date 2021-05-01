require("dotenv").config();
import "hardhat-typechain";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";
const flare = require("../flare/client/config.json");

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
    local: {
      url: "http://127.0.0.1:9650/ext/bc/C/rpc",
      accounts: [flare.accounts[0].privateKey, flare.accounts[1].privateKey],
      chainId: 16,
    },
    private: {
      url: "https://coston.trustline.co/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 16,
    },
  },
  solidity: "0.8.0",
};

export default config;
