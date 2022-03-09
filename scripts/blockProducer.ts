import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    "http://127.0.0.1:9650/ext/bc/C/rpc"
  );
  const wallet = new ethers.Wallet(
    "d77b743a0b9170c230e4a4be446b8605aa45f1d00da3d8cd5e5f778c287e1f22",
    provider
  );
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
