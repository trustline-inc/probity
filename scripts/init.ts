import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.CURRENCY)
  throw Error("Must sent the CURRENCY environment variable.");
if (!["aurei", "phi"].includes(process.env.CURRENCY))
  throw Error("Invalid currency type.");

const COLLATERAL = {
  FLR: web3.utils.keccak256("FLR"),
  SGB: web3.utils.keccak256("SGB"),
};

const PRECISION_COLL = ethers.BigNumber.from("1000000000000000000");
const PRECISION_AUR = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

const init = async () => {
  // Wallets
  const [owner]: SignerWithAddress[] = await ethers.getSigners();

  // ABIs
  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const TellerABI = await artifacts.readArtifact("Teller");
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");

  // Contracts
  const priceFeed = new ethers.Contract(
    process.env.PRICE_FEED,
    PriceFeedABI.abi,
    owner
  );
  const teller = new ethers.Contract(process.env.TELLER, TellerABI.abi, owner);
  const vaultEngine = new ethers.Contract(
    process.env.VAULT_ENGINE,
    VaultEngineABI.abi,
    owner
  );

  // // Initialize native collateral type
  console.log(`Initializing ${process.env.CURRENCY} collateral`);
  await vaultEngine
    .connect(owner)
    .initCollType(COLLATERAL[process.env.CURRENCY]);
  console.log(`Vault: ${process.env.CURRENCY} initialized.`);
  await vaultEngine
    .connect(owner)
    .updateCeiling(
      COLLATERAL[process.env.CURRENCY],
      PRECISION_AUR.mul(10000000)
    );
  console.log(`Vault: ceiling updated.`);
  await teller
    .connect(owner)
    .initCollType(COLLATERAL[process.env.CURRENCY], 0, { gasLimit: 300000 });
  console.log(`Teller: ${process.env.CURRENCY} initialized.`);
  await priceFeed
    .connect(owner)
    .init(
      COLLATERAL[process.env.CURRENCY],
      PRECISION_COLL.mul(150),
      process.env.FTSO
    );
  console.log(`PriceFeed: ${process.env.CURRENCY} price initialized.`);
  await priceFeed
    .connect(owner)
    .updatePrice(COLLATERAL[process.env.CURRENCY], { gasLimit: 300000 });
  console.log(`PriceFeed: ${process.env.CURRENCY} price updated.`);
};

init();
