const Web3 = require("web3");
import { existsSync } from "fs";
import * as ethers from "ethers";
import { artifacts } from "hardhat";
import axios from "axios";

const RPC_URL = "http://127.0.0.1:9650/ext/bc/C/rpc";
const web3 = new Web3(RPC_URL);

const UPDATE_INTERVAL = 30000; // 30 sec

if (!process.env.FLARE_DIR) {
  throw Error("FLARE_DIR not set.");
}

// Add Flare local accounts from Flare config
const flareLocalAccounts: any[] = [];
const flareConfPath = `${process.env.FLARE_DIR}/src/stateco/client/config.json`;
if (existsSync(flareConfPath)) {
  // tslint:disable-next-line no-var-requires
  const flareConf = require(flareConfPath);
  flareLocalAccounts.push(flareConf.accounts[0].privateKey);
  flareLocalAccounts.push(flareConf.accounts[1].privateKey);
}

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let wallet = new ethers.Wallet(flareLocalAccounts[0]).connect(provider);
  const ftso = new ethers.Contract(
    process.env.FTSO,
    (await artifacts.readArtifact("MockFtso")).abi,
    provider
  );

  try {
    const ftsoContract = ftso.connect(wallet);
    const [price] = await ftsoContract.getCurrentPrice();
    console.log("Current price:", price.toString());

    const response = await axios({
      url: `https://min-api.cryptocompare.com/data/price?fsym=SGB&tsyms=USD`,
      headers: { Authorization: `Apikey ${process.env.CRYPTOCOMPARE_API_KEY}` },
    });

    // TODO: Update this calculation to ensure that it is accurate.
    const newPrice = ethers.BigNumber.from("1000000000000000000000000000")
      .mul(Math.floor(response.data.USD * 1000))
      .div(1000);
    console.log("New price:", newPrice.toString());
    let tx = await ftsoContract.setCurrentPrice(newPrice, {
      gasPrice: web3.utils.toWei("225", "Gwei"),
      gasLimit: 300000,
    });
    await tx.wait();

    const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
    const priceFeed = new ethers.Contract(
      process.env.PRICE_FEED,
      PriceFeedABI.abi,
      provider
    );
    tx = await priceFeed
      .connect(wallet)
      .updateAdjustedPrice(web3.utils.keccak256("SGB"), {
        gasLimit: 300000,
      });
    await tx.wait();

    console.log(`sleeping for ${UPDATE_INTERVAL / 1000} seconds`);
    setTimeout(() => main(), UPDATE_INTERVAL);
  } catch (error) {
    console.log(error);
  }
}

main();
