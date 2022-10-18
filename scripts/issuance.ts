/**
 * Script that perpetually calls Teller.updateAccumulator()
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import { RAD } from "../test/utils/constants";

const account = "0x11EeB875AAc42eEe7CB37668360206B0056F6eEd";
const wallet = new ethers.Wallet(
  "a59bc90d864e28891df18f0cf49b2a1a53944467307c10d0650676f7a1394eec",
  new ethers.providers.JsonRpcProvider(hre.network.url)
);
const amount = RAD.mul(1_000_000);

(async () => {
  let [owner] = await ethers.getSigners();
  const VaultEngineIssuerABI = await artifacts.readArtifact(
    "VaultEngineIssuer"
  );
  const TreasuryABI = await artifacts.readArtifact("Treasury");
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineIssuerABI.abi,
    owner
  );
  const treasury = new Contract(process.env.TREASURY!, TreasuryABI.abi, owner);

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
    let tx = await vaultEngine.modifySupply(account, amount, {
      gasLimit: 400000,
    });
    console.log(tx);
    let result = await tx.wait();
    console.log(result);
    tx = await treasury
      .connect(wallet)
      .withdrawSystemCurrency(ethers.utils.parseUnits(String(1_000_000), 18), {
        gasLimit: 400000,
      });
    console.log(tx);
    result = await tx.wait();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
})();
