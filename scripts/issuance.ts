/**
 * Script that perpetually calls Teller.updateAccumulator()
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import { RAD } from "../test/utils/constants";

const account = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";
const amount = RAD.mul(1_000_000);

(async () => {
  let [owner] = await ethers.getSigners();
  const VaultEngineIssuerABI = await artifacts.readArtifact(
    "VaultEngineIssuer"
  );
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineIssuerABI.abi,
    owner
  );

  console.log("Issuing USD...", {
    account,
    amount: amount.toString(),
    vaultEngine: vaultEngine.address,
  });

  try {
    // Use callStatic to check for errors
    await vaultEngine.callStatic.modifySupply(account, amount, {
      gasLimit: 400000,
    });
    const tx = await vaultEngine.modifySupply(account, amount, {
      gasLimit: 400000,
    });
    console.log(tx);
    const result = await tx.wait();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
})();
