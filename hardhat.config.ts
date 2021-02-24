require('dotenv').config()
import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  defaultNetwork: "coston",
  networks: {
    coston: {
      url: "https://costone.flare.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  solidity: "0.8.0"
};

export default config;