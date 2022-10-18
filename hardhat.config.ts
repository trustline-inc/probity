require("dotenv").config();
import "hardhat-ethernal";
import "solidity-coverage";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-waffle";
import { HardhatUserConfig } from "hardhat/config";

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
  networks: {
    localhost: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
      allowUnlimitedContractSize: true,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      accounts: [
        "9f05cbe65ef2defab75440cb91ca1de405233a9f6c3d16bc1a5433edc28f20b4",
      ],
    },
    // See https://hardhat.org/hardhat-network/docs/reference#supported-fields
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
      accounts: [
        // TODO: Read this from encrypted keystore file
        "e8eb815fca4f7febe74b9cfb026c640ac6d607b0c6fd65df40b7584e285f19b3",
      ],
      chainId: 4294967295,
    },
    flare_internal: {
      url: "https://coston.trustline.co/ext/bc/C/rpc",
      accounts: [
        "44b8de040dec19cf810efe64919b481e05e2ba643efe003223662f1626b114f0",
        "d77b743a0b9170c230e4a4be446b8605aa45f1d00da3d8cd5e5f778c287e1f22",
      ],
      chainId: 4294967295,
    },
    coston: {
      url: "https://coston-api.flare.network/ext/bc/C/rpc",
      accounts: [
        "e8eb815fca4f7febe74b9cfb026c640ac6d607b0c6fd65df40b7584e285f19b3",
      ],
      chainId: 16,
    },
    songbird: {
      url: "https://songbird.towolabs.com/rpc",
      chainId: 19,
      accounts: {
        mnemonic: "",
      },
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
