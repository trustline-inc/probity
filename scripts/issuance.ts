/**
 * Script that issues USD
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import config from "../hardhat.config";
import { RAD } from "../test/utils/constants";

const beneficiary = "";
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/");
const path = "m/44'/60'/0'/0/1";
const wallet = new ethers.Wallet.fromMnemonic(
  config.networks.localhost?.accounts.mnemonic,
  path
).connect(provider);
const amount = RAD.mul(1_000_000);

(async () => {
  const [admin]: SignerWithAddress[] = await ethers.getSigners();
  const VaultEngineIssuerABI = await artifacts.readArtifact(
    "VaultEngineIssuer"
  );
  const TreasuryABI = await artifacts.readArtifact("Treasury");
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineIssuerABI.abi,
    admin
  );
  const treasury = new Contract(process.env.TREASURY!, TreasuryABI.abi, admin);
  const UsdABI = await artifacts.readArtifact("Usd");
  const usd = new Contract(process.env.USD!, UsdABI.abi, admin);

  console.log("Issuing USD...", {
    to: wallet.address,
    amount: amount.div(RAD).toString(),
    from: admin.address,
    vaultEngine: vaultEngine.address,
  });

  try {
    // Use callStatic to check for errors
    await vaultEngine.callStatic.modifySupply(wallet.address, amount, {
      gasLimit: 400000,
    });
    console.log("Tx: vaultEngine.modifySupply");
    let tx = await vaultEngine.modifySupply(wallet.address, amount, {
      gasLimit: 400000,
    });
    console.log(tx);
    let result = await tx.wait();
    console.log(result);

    // Fund beneficiary wallet 1 ETH to pay for withdraw tx fee
    console.log("Tx: admin.sendTransaction");
    tx = await admin.sendTransaction({
      to: wallet.address,
      value: ethers.BigNumber.from("1000000000000000000"),
    });
    console.log(tx);
    result = await tx.wait();
    console.log(result);

    console.log("Tx: treasury.withdrawSystemCurrency");
    tx = await treasury
      .connect(
        wallet.connect(new ethers.providers.JsonRpcProvider(hre.network.url))
      )
      .withdrawSystemCurrency(ethers.utils.parseUnits(String(1_000_000), 18), {
        gasLimit: 400000,
      });
    console.log(tx);
    result = await tx.wait();
    console.log(result);

    if (beneficiary) {
      usd.connect(wallet).transfer(beneficiary, amount.div(RAD).toString());
    }
  } catch (error) {
    console.log(error);
  }
})();
