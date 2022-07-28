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
  const teller = new Contract(process.env.TELLER!, TellerABI.abi, owner);

  setInterval(async () => {
    console.log("Updating rates...");

    // Update rates for native token & USD token
    try {
      // Use callStatic to check for errors before signing
      await teller.callStatic.updateAccumulators({
        gasLimit: 300000,
        maxFeePerGas: 25 * 1e9,
      });
      let tx = await teller.updateAccumulators({
        gasLimit: 300000,
        maxFeePerGas: 25 * 1e9,
      });
      console.log(tx);
      let result = await tx.wait();
      console.log(result);
    } catch (error) {
      console.log(error);
    }
  }, 60000);
})();
