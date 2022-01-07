import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.TOKEN)
  throw Error("Must sent the TOKEN environment variable.");
if (!["FLR", "SGB"].includes(process.env.TOKEN.toUpperCase()))
  throw Error("Invalid token type.");

const token = process.env.TOKEN.toUpperCase();

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
  const trustlineAddress = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";

  // ABIs
  const RegistryABI = await artifacts.readArtifact("Registry");
  const LiquidatorABI = await artifacts.readArtifact("Liquidator");
  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const TellerABI = await artifacts.readArtifact("Teller");
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");
  const VaultEngineSBABI = await artifacts.readArtifact("VaultEngineSB");

  // Contracts
  const registry = new ethers.Contract(
    process.env.REGISTRY,
    RegistryABI.abi,
    owner
  );
  const liquidator = new ethers.Contract(
    process.env.LIQUIDATOR,
    LiquidatorABI.abi,
    owner
  );
  const priceFeed = new ethers.Contract(
    process.env.PRICE_FEED,
    PriceFeedABI.abi,
    owner
  );
  const teller = new ethers.Contract(process.env.TELLER, TellerABI.abi, owner);
  const vaultEngine = new ethers.Contract(
    token === "SGB" ? process.env.VAULT_ENGINE_S_B : process.env.VAULT_ENGINE,
    token === "SGB" ? VaultEngineSBABI.abi : VaultEngineABI.abi,
    owner
  );

  // One address can only have one role
  // Note: governance address is set at deployment
  console.log(`Whitelisting address: ${trustlineAddress}`);
  let tx = await registry
    .connect(owner)
    .setupAddress(
      ethers.utils.formatBytes32String("whiteListed"),
      trustlineAddress,
      {
        gasLimit: 300000,
      }
    );
  await tx.wait();

  // Initialize vault collateral type
  console.log(`Initializing ${token} collateral`);
  tx = await vaultEngine
    .connect(owner)
    .initAssetType(COLLATERAL[token], { gasLimit: 400000 });
  await tx.wait();
  console.log(`Vault: ${token} initialized`);

  // Set individual vault limit
  if (token === "SGB") {
    const limit = 1000;
    tx = await vaultEngine
      .connect(owner)
      .updateIndividualVaultLimit(PRECISION_AUR.mul(limit), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: individual limit set to ${limit} ${token}`);
  }

  // Update debt ceiling
  const ceiling = 10000000;
  tx = await vaultEngine
    .connect(owner)
    .updateCeiling(COLLATERAL[token], PRECISION_AUR.mul(ceiling), {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(`Vault: ceiling updated to ${ceiling} ${token}`);

  // Update debt floor
  const floor = 1;
  tx = await vaultEngine
    .connect(owner)
    .updateFloor(COLLATERAL[token], PRECISION_COLL.mul(floor), {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(`Vault: floor updated to ${floor} ${token}`);

  // Initialize teller collateral type
  tx = await teller
    .connect(owner)
    .initAssetType(COLLATERAL[token], 0, { gasLimit: 300000 });
  await tx.wait();
  console.log(`Teller: ${token} initialized`);

  // Initialize liquidator collateral type
  tx = await liquidator
    .connect(owner)
    .init(COLLATERAL[token], process.env.AUCTIONEER, { gasLimit: 300000 });
  await tx.wait();
  console.log(`Liquidator: ${token} initialized`);

  // Initialize price feed collateral type
  const liqRatio = PRECISION_COLL.mul(15).div(10);
  tx = await priceFeed
    .connect(owner)
    .init(COLLATERAL[token], liqRatio, process.env.FTSO, {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(
    `PriceFeed: ${token} price initialized with ${ethers.utils
      .formatEther(liqRatio)
      .toString()} liq. ratio`
  );

  // Update collateral price
  tx = await priceFeed
    .connect(owner)
    .updateAdjustedPrice(COLLATERAL[token], { gasLimit: 300000 });
  await tx.wait();
  console.log(`PriceFeed: ${token} price updated`);
};

init();
