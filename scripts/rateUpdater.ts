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

  setInterval(async () => {
    console.log("Updating rates...");
    const tx = await teller.updateIndices(web3.utils.keccak256("FLR"), {
      gasLimit: 400000,
    });
    console.log(tx);
    const result = await tx.wait();
    console.log(result); // CALL_EXCEPTION
  }, 5000);
})();
