require("dotenv").config();
import { existsSync } from "fs";
import "hardhat-typechain";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";

// Add Flare local accounts from Flare config
const flareLocalAccounts = [];
const flareConfPath = `${process.env.FLARE_DIR}/client/config.json`;
if (existsSync(flareConfPath)) {
  const flareConf = require(flareConfPath);
  flareLocalAccounts.push(flareConf.accounts[0].privateKey);
  flareLocalAccounts.push(flareConf.accounts[1].privateKey);
}

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
      accounts: flareLocalAccounts,
      chainId: 16,
    },
  },
  solidity: "0.8.0",
};

export default config;
