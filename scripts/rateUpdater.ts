/**
 * Script that perpetually calls Teller.updateAccumulator()
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import { Contract } from "ethers";
import getNativeToken from "../lib/getNativeToken";

const nativeToken = getNativeToken();

(async () => {
  let [owner] = await ethers.getSigners();
  const TellerABI = await artifacts.readArtifact("Teller");
  const teller = new Contract(process.env.TELLER, TellerABI.abi, owner);

  setInterval(async () => {
    console.log("Updating rates...");

    try {
      // Use callStatic to check for errors
      await teller.callStatic.updateAccumulators(
        web3.utils.keccak256(nativeToken),
        {
          gasLimit: 400000,
        }
      );
      const tx = await teller.updateAccumulators(
        web3.utils.keccak256(nativeToken),
        {
          gasLimit: 400000,
        }
      );
      console.log(tx);
      const result = await tx.wait();
      console.log(result);
    } catch (error) {
      console.log(error);
    }
  }, 60000);
})();
