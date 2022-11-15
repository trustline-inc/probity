/**
 * Script that issues USD
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import config from "../hardhat.config";
import { RAD } from "../test/utils/constants";

const beneficiary = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";
const wallet = new ethers.Wallet.fromMnemonic(
  config.networks.localhost?.accounts.mnemonic,
  "m/44'/60'/0'/0/0"
).connect(new ethers.providers.JsonRpcBatchProvider("http://localhost:8545"));
const amount = "100000";

(async () => {
  const [gov]: SignerWithAddress[] = await ethers.getSigners();

  const VaultEngineIssuerABI = await artifacts.readArtifact(
    "VaultEngineIssuer"
  );
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineIssuerABI.abi,
    gov
  );

  const TreasuryABI = await artifacts.readArtifact("Treasury");
  const treasury = new Contract(process.env.TREASURY!, TreasuryABI.abi, gov);

  const UsdABI = await artifacts.readArtifact("USD");
  const usd = new Contract(process.env.USD!, UsdABI.abi, gov);

  const LqoABI = await artifacts.readArtifact("LQO");
  const lqo = new Contract(process.env.LQO!, LqoABI.abi, gov);

  try {
    // Fund beneficiary wallet 10 ETH to pay for tx fees
    console.log("Tx: gov.sendTransaction");
    let tx = await gov.sendTransaction({
      to: beneficiary,
      value: ethers.BigNumber.from("1000000000000000000"),
    });
    console.log(tx);
    let result = await tx.wait();
    console.log(result);

    if (beneficiary) {
      await usd.connect(wallet).transfer(beneficiary, amount);
      await lqo.connect(wallet).transfer(beneficiary, amount);
    }
  } catch (error) {
    console.log(error);
  }
})();
