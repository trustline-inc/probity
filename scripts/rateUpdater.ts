/**
 * Script that perpetually calls Teller.updateIndices()
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import { Contract } from "ethers";

(async () => {
  let [owner] = await ethers.getSigners();
  const TellerABI = await artifacts.readArtifact("Teller");
  const teller = new Contract(process.env.TELLER, TellerABI.abi, owner);
  await teller.updateIndices(web3.utils.keccak256("FLR"), { gasLimit: 400000 });
})();
