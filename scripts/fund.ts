import "@nomiclabs/hardhat-waffle";
import { ethers, network } from "hardhat";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

const fund = async (to: string) => {
  let owner: SignerWithAddress;
  [owner] = await ethers.getSigners();

  // Fund account with 1 ETH
  await owner.sendTransaction({
    to,
    value: ethers.BigNumber.from("1000000000000000000"),
  });
  await network.provider.send("evm_mine");
};

fund("0xb7b685dD1b52D2939bD6f5d9515635c5a633fFAA")
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
