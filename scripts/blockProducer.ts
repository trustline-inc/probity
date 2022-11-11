/**
 * This script produces blocks by sending transactions.
 */
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    "http://127.0.0.1:8545/"
  );
  const path = "m/44'/60'/0'/0/1";
  const wallet = new ethers.Wallet.fromMnemonic(
    config.networks.localhost?.accounts.mnemonic,
    path
  ).connect(provider);
  const to = "0xb7b685dD1b52D2939bD6f5d9515635c5a633fFAA";

  setInterval(async () => {
    // Send transaction with minimal value to produce a block
    const receipt = await wallet.sendTransaction({
      to,
      value: ethers.BigNumber.from("1"),
      gasLimit: 21000,
      gasPrice: 225000000000,
    });
    console.log(receipt);
    const result = await receipt.wait();
    console.log(result);
  }, 5000);
})();
