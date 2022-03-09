import { Contract } from "ethers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import axios from "axios";
import * as dotenv from "dotenv";
import getNativeToken from "../lib/getNativeToken";
dotenv.config();

const nativeToken = getNativeToken();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  let [owner] = await ethers.getSigners();
  const FtsoABI = await artifacts.readArtifact("MockFtso");
  const ftso = new Contract(process.env.FTSO, FtsoABI.abi, owner);

  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const priceFeed = new ethers.Contract(
    process.env.PRICE_FEED,
    PriceFeedABI.abi,
    owner
  );

  setInterval(async () => {
    console.log("Updating price...");

    try {
      /**
       * Below is handled by FTSO in production
       */
      const [price] = await ftso.getCurrentPrice();
      console.log("Current price:", String(ethers.utils.formatUnits(price, 5)));

      const response = await axios({
        url: `https://min-api.cryptocompare.com/data/price?fsym=SGB&tsyms=USD`,
        headers: {
          Authorization: `Apikey ${process.env.CRYPTOCOMPARE_API_KEY}`,
        },
      });
      const newPrice = String(
        ethers.utils.parseUnits(response.data.USD.toString(), 5)
      );
      console.log("New price:", String(ethers.utils.formatUnits(newPrice, 5)));
      let tx = await ftso.setCurrentPrice(newPrice, {
        gasPrice: web3.utils.toWei("225", "Gwei"),
        gasLimit: 300000,
      });
      await tx.wait();

      /**
       * Update the Probity system's price
       */
      tx = await priceFeed
        .connect(owner)
        .updateAdjustedPrice(web3.utils.keccak256(nativeToken), {
          gasLimit: 300000,
        });
      await tx.wait();
    } catch (error) {
      console.log(error);
    }
  }, 5000);
})();
