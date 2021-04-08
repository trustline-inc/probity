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
      url: "https://costone.flare.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },
    hardhat: {
      chainId: 1337,
    },
    trustline: {
      url: "https://coston.trustline.co/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  solidity: "0.8.0",
};

export default config;
