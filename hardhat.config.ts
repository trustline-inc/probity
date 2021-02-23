import "@nomiclabs/hardhat-ethers";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  defaultNetwork: "coston",
  networks: {
    coston: {
      url: "https://costone.flare.network/ext/bc/C/rpc",
      accounts: ["cc06775b75e06a53961d9a2fb62fae0f16d354077d9176e8ad474ebd9eef57d2"]
    }
  },
  solidity: "0.8.0"
};

export default config;