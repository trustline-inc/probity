import { Contract } from "ethers";
import { artifacts, ethers, web3 } from "hardhat";
import axios from "axios";

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
      const [price] = await ftso.getCurrentPrice();
      console.log("Current price:", price.toString());

      const response = await axios({
        url: `https://min-api.cryptocompare.com/data/price?fsym=SGB&tsyms=USD`,
        headers: {
          Authorization: `Apikey ${process.env.CRYPTOCOMPARE_API_KEY}`,
        },
      });

      // TODO: Update this calculation to ensure that it is accurate.
      const newPrice = ethers.BigNumber.from("1000000000000000000000000000")
        .mul(Math.floor(response.data.USD * 1000))
        .div(1000);
      console.log("New price:", newPrice.toString());
      let tx = await ftso.setCurrentPrice(newPrice, {
        gasPrice: web3.utils.toWei("225", "Gwei"),
        gasLimit: 300000,
      });
      await tx.wait();

      tx = await priceFeed
        .connect(owner)
        .updateAdjustedPrice(web3.utils.keccak256("SGB"), {
          gasLimit: 300000,
        });
      await tx.wait();
    } catch (error) {
      console.log(error);
    }
  }, 5000);
})();
