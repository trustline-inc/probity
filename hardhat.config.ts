require("dotenv").config();
import "hardhat-ethernal";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";
import Wallet from "ethereumjs-wallet";
import fs from "fs";

const privateKey = Wallet.fromV3(
  fs.readFileSync(process.env.KEYSTORE_FILE).toString(),
  process.env.KEYSTORE_PASSWORD,
  true
)
  .getPrivateKey()
  .toString("hex");

// See https://hardhat.org/hardhat-runner/docs/config#available-config-options
const config: HardhatUserConfig = {
  defaultNetwork: "localhost",
  ethernal: {
    workspace: "Probity",
    email: process.env.ETHERNAL_EMAIL,
    password: process.env.ETHERNAL_PASSWORD,
    disabled: process.env.NODE_ENV === "test",
    uploadAst: true,
  },
  // See https://hardhat.org/hardhat-network/docs/reference#supported-fields
  networks: {
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      allowUnlimitedContractSize: true,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      accounts: {
        mnemonic:
          "refuse inherit state window exercise carpet circle empty scan exclude talk cargo",
        accountsBalance: "100000000000000000000000000",
      },
    },
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      accounts: {
        mnemonic:
          "refuse inherit state window exercise carpet circle empty scan exclude talk cargo",
        accountsBalance: "100000000000000000000000000",
      },
    },
    flare_local: {
      url: "http://127.0.0.1:9650/ext/bc/C/rpc",
      accounts: [privateKey],
      chainId: 4294967295,
    },
    coston: {
      url: "https://coston-api.flare.network/ext/bc/C/rpc",
      accounts: [privateKey],
      chainId: 16,
    },
    songbird: {
      url: "https://songbird.towolabs.com/rpc",
      chainId: 19,
      accounts: [privateKey],
    },
  },
  solidity: "0.8.4",
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
    externalArtifacts: [],
  },
};

export default config;
