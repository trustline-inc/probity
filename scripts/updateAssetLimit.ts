import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import { artifacts, ethers, web3 } from "hardhat";
import { WAD, RAD } from "../test/utils/constants";

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function main() {
  const [owner] = await ethers.getSigners();

  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");

  const asset = "USD";
  const assetId = web3.utils.keccak256(asset);
  console.log(`Asset ID: ${assetId}`);

  const vaultEngine = new ethers.Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineABI.abi,
    owner
  );
  console.log(`VaultEngine address: ${vaultEngine.address}`);

  // Update vault debt ceiling to 10M USD
  const ceiling = 10_000_000;
  let tx = await vaultEngine
    .connect(owner)
    .updateCeiling(assetId, RAD.mul(ceiling), {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(`Vault: ceiling updated to ${ceiling}`);

  // Update vault debt floor to 1 USD
  const floor = 1;
  tx = await vaultEngine.connect(owner).updateFloor(assetId, WAD.mul(floor), {
    gasLimit: 300000,
  });
  await tx.wait();
  console.log(`Vault: floor updated to ${floor}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
