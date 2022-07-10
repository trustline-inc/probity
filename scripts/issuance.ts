/**
 * Script that perpetually calls Teller.updateAccumulator()
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import { Contract } from "ethers";

const token = "USD";
const treasuryAddress = "0x5e3e6273604C120182b2e4d6Bfcf451F58477631";
const account = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";
const amount = ethers.BigNumber.from("1000000000000000000");

(async () => {
  let [owner] = await ethers.getSigners();
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineABI.abi,
    owner
  );

  console.log("Issuing USD...");

  try {
    // Use callStatic to check for errors
    await vaultEngine.callStatic.modifySupply(
      web3.utils.keccak256(token),
      treasuryAddress,
      account,
      amount,
      {
        gasLimit: 400000,
      }
    );
    const tx = await vaultEngine.modifySupply(
      web3.utils.keccak256(token),
      treasuryAddress,
      account,
      amount,
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
})();
