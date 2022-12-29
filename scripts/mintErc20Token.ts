/**
 * Script that issues an ERC20 token
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import config from "../hardhat.config";
import { WAD } from "../test/utils/constants";

// Recipient address
const beneficiary = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";

// Operational issuance wallet
const issuer = new ethers.Wallet(
  "fe71f9a709f31ac88a6cd2aea74bfd66e5b99169d1650cbe10fec163786c8671",
  new ethers.providers.JsonRpcProvider("https://rpc-evm-sidechain.xrpl.org")
);
const amount = WAD.mul(1_000_000);

(async () => {
  const [gov]: SignerWithAddress[] = await ethers.getSigners();

  const LqoABI = await artifacts.readArtifact("LQO");
  const lqo = new Contract(process.env.LQO!, LqoABI.abi, gov);

  console.log("Issuing LQO...", {
    to: beneficiary,
    amount: amount.div(WAD).toString(),
    from: gov.address,
  });

  try {
    const tx = await lqo.connect(gov).mint(beneficiary, amount);
    const result = await tx.wait();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
})();
