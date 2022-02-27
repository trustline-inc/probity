import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import * as dotenv from "dotenv";
import * as hre from "hardhat";
dotenv.config();

const networkName = hre.network.name;

if (["local", "internal"].includes(networkName) && !process.env.NATIVE_TOKEN)
  throw Error("Must sent the NATIVE_TOKEN environment variable.");
if (!["CFLR", "FLR", "SGB"].includes(process.env.NATIVE_TOKEN.toUpperCase()))
  throw Error("Invalid native token type.");

const nativeToken = process.env.NATIVE_TOKEN.toUpperCase();

const ASSETS = {
  CFLR: web3.utils.keccak256("CFLR"),
  FLR: web3.utils.keccak256("FLR"),
  SGB: web3.utils.keccak256("SGB"),
};

const WAD = ethers.BigNumber.from("1000000000000000000");
const RAD = WAD.pow(2).mul(1e9);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

/**
 * Initialize the system into a ready state
 */
const init = async () => {
  // Wallets
  const [owner]: SignerWithAddress[] = await ethers.getSigners();
  const TRUSTLINE_INC = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";

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
    process.env.VAULT_ENGINE_S_B
      ? process.env.VAULT_ENGINE_S_B
      : process.env.VAULT_ENGINE,
    process.env.VAULT_ENGINE_S_B ? VaultEngineSBABI.abi : VaultEngineABI.abi,
    owner
  );

  // Allows Trustline. An address can only have one role at a time.
  // Note: governance address was set at deployment
  console.log(`Allowing address: ${TRUSTLINE_INC}`);
  let tx = await registry
    .connect(owner)
    .setupAddress(
      ethers.utils.formatBytes32String("whitelisted"),
      TRUSTLINE_INC,
      {
        gasLimit: 300000,
      }
    );
  await tx.wait();

  // Initialize the native token in VaultEngine
  console.log(`Initializing ${nativeToken} asset`);
  tx = await vaultEngine
    .connect(owner)
    .initAsset(ASSETS[nativeToken], { gasLimit: 400000 });
  await tx.wait();
  console.log(`Vault: ${nativeToken} initialized`);

  // Limit songbird vault to 1000 AUR
  if (networkName === "songbird") {
    const limit = 1000;
    tx = await vaultEngine
      .connect(owner)
      .updateIndividualVaultLimit(RAD.mul(limit), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: individual limit set to ${limit} ${nativeToken}`);
  }

  // Update vault debt ceiling to 10M AUR
  const ceiling = 10_000_000;
  tx = await vaultEngine
    .connect(owner)
    .updateCeiling(ASSETS[nativeToken], RAD.mul(ceiling), {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(`Vault: ceiling updated to ${ceiling} ${nativeToken}`);

  // Update vault debt floor to 1 AUR
  const floor = 1;
  tx = await vaultEngine
    .connect(owner)
    .updateFloor(ASSETS[nativeToken], WAD.mul(floor), {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(`Vault: floor updated to ${floor} ${nativeToken}`);

  // Initialize native token in Teller (sets default protocol fee)
  tx = await teller
    .connect(owner)
    .initAsset(ASSETS[nativeToken], 0, { gasLimit: 300000 });
  await tx.wait();
  console.log(`Teller: ${nativeToken} initialized`);

  // Initialize native token in Liquidator (sets default penalty fees)
  tx = await liquidator
    .connect(owner)
    .initAsset(ASSETS[nativeToken], process.env.AUCTIONEER, {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(`Liquidator: ${nativeToken} initialized`);

  // Initialize native token price feed
  const liqRatio = WAD.mul(15).div(10);
  tx = await priceFeed
    .connect(owner)
    .initAsset(ASSETS[nativeToken], liqRatio, process.env.FTSO, {
      gasLimit: 300000,
    });
  await tx.wait();
  console.log(
    `PriceFeed: ${nativeToken} price initialized with ${ethers.utils
      .formatEther(liqRatio)
      .toString()} liq. ratio`
  );

  // Fetch native token price
  tx = await priceFeed
    .connect(owner)
    .updateAdjustedPrice(ASSETS[nativeToken], { gasLimit: 300000 });
  await tx.wait();
  console.log(`PriceFeed: ${nativeToken} price updated`);
};

init();
