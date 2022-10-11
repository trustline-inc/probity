/**
 * Script that perpetually calls Teller.updateAccumulator()
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import { RAD, RAY } from "../test/utils/constants";

const beneficiary = {
  address: "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD",
  secret: "a59bc90d864e28891df18f0cf49b2a1a53944467307c10d0650676f7a1394eec",
};

// Currently, the beneficiary MUST be Linqto/Trustline Inc.
const beneficiaryWallet = new ethers.Wallet(
  beneficiary.secret,
  new ethers.providers.JsonRpcProvider("http://localhost:9650/ext/bc/C/rpc")
);

const amount = 1_000_000;

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
  const { chainId, name } = await provider.getNetwork();

  const issuanceDetails = {
    networkChainId: chainId,
    networkName: name,
    beneficiaryAddress: beneficiary.address,
    amount: amount.toString(),
    vaultEngine: vaultEngine.address,
  };
  console.log("Issuing USD...", issuanceDetails);

  try {
    // Use callStatic to check for errors
    await vaultEngine.callStatic.modifySupply(
      beneficiary.address,
      ethers.utils.parseUnits(String(amount), 45),
      {
        gasLimit: 400000,
      }
    );
    let tx = await vaultEngine.modifySupply(
      beneficiary.address,
      ethers.utils.parseUnits(String(amount), 45),
      {
        gasLimit: 400000,
      }
    );
    console.log(tx);
    let result = await tx.wait();
    console.log(result);
    tx = await treasury
      .connect(beneficiaryWallet)
      .withdrawStablecoin(ethers.utils.parseUnits(String(amount), 18), {
        gasLimit: 400000,
      });
    console.log(tx);
    result = await tx.wait();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
})();
