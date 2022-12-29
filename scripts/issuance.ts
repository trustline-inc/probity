/**
 * Script that issues USD
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers } from "hardhat";
import { Contract } from "ethers";
import config from "../hardhat.config";
import { RAD } from "../test/utils/constants";

// Recipient address
const beneficiary = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";

// const wallet = new ethers.Wallet.fromMnemonic(
//   config.networks.localhost?.accounts.mnemonic,
//   "m/44'/60'/0'/0/1"
// );

// Operational issuance wallet
const issuer = new ethers.Wallet(
  "fe71f9a709f31ac88a6cd2aea74bfd66e5b99169d1650cbe10fec163786c8671",
  new ethers.providers.JsonRpcProvider("https://rpc-evm-sidechain.xrpl.org")
);
const amount = RAD.mul(1_000_000);

(async () => {
  const [gov]: SignerWithAddress[] = await ethers.getSigners();
  const VaultEngineIssuerABI = await artifacts.readArtifact(
    "VaultEngineIssuer"
  );
  const TreasuryABI = await artifacts.readArtifact("Treasury");
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineIssuerABI.abi,
    gov
  );
  const treasury = new Contract(process.env.TREASURY!, TreasuryABI.abi, issuer);
  const UsdABI = await artifacts.readArtifact("USD");
  const usd = new Contract(process.env.USD!, UsdABI.abi, gov);

  console.log("Issuing USD...", {
    to: issuer.address,
    amount: amount.div(RAD).toString(),
    from: gov.address,
    vaultEngine: vaultEngine.address,
  });

  try {
    // Increase issuer wallet USD balance as gov
    // Use callStatic to check for errors
    await vaultEngine.callStatic.modifySupply(issuer.address, amount, {
      gasLimit: 400000,
    });
    console.log("Tx: vaultEngine.modifySupply");
    let tx = await vaultEngine.modifySupply(issuer.address, amount, {
      gasLimit: 400000,
    });
    console.log(tx);
    let result = await tx.wait();
    console.log(result);

    // Check issuer balance
    let balance = await vaultEngine.systemCurrency(issuer.address);
    console.log(`Issuer balance is ${balance.div(RAD)} USD`);

    // Fund issuer wallet 1 XRP to pay for withdraw tx fee
    console.log("Tx: gov.sendTransaction");
    tx = await gov.sendTransaction({
      to: issuer.address,
      value: ethers.BigNumber.from("1000000000000000000"),
    });
    console.log(tx);
    result = await tx.wait();
    console.log(result);

    console.log("Tx: treasury.withdrawSystemCurrency");
    const withdrawAmount = ethers.utils.parseUnits(String(1_000_000), 18);
    console.log(`Withdraw amount is ${withdrawAmount}`);
    tx = await treasury.connect(issuer).withdrawSystemCurrency(withdrawAmount, {
      gasLimit: 400000,
    });
    console.log(tx);
    result = await tx.wait();
    console.log(result);

    if (beneficiary) {
      console.log("Tx: usd.balanceOf");
      balance = await usd.balanceOf(issuer.address);
      console.log(`Balance of issuer is ${balance.toString()}`);
      console.log("Tx: usd.transfer");
      usd.connect(issuer).transfer(beneficiary, withdrawAmount.toString());
    }
  } catch (error) {
    console.log(error);
  }
})();
