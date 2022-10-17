import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import * as hre from "hardhat";
import { artifacts, ethers, web3 } from "hardhat";
import { getNativeToken } from "../lib/utils";

const nativeToken: string = getNativeToken();
const networkName = hre.network.name;

const NATIVE_ASSETS: { [key: string]: string } = {
  CFLR: web3.utils.keccak256("CFLR"),
  ETH: web3.utils.keccak256("ETH"),
  FLR: web3.utils.keccak256("FLR"),
  SGB: web3.utils.keccak256("SGB"),
  XRP: web3.utils.keccak256("XRP"),
};

const ERC20_ASSETS = {
  FXRP: web3.utils.keccak256("FXRP"),
  USD: web3.utils.keccak256("USD"),
  XAU: web3.utils.keccak256("XAU"),
};

const WAD = ethers.BigNumber.from("1000000000000000000");
const RAD = WAD.pow(2).mul(1e9);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

/**
 * Initialize the system into a ready state
 */
const init = async () => {
  // Wallets
  const [gov]: SignerWithAddress[] = await ethers.getSigners();
  const TRUSTLINE_INC = "0x11EeB875AAc42eEe7CB37668360206B0056F6eEd";
  const allowlist = [TRUSTLINE_INC];

  // ABIs
  const RegistryABI = await artifacts.readArtifact("Registry");
  const LiquidatorABI = await artifacts.readArtifact("Liquidator");
  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");
  const NativeAssetManagerABI = await artifacts.readArtifact(
    "NativeAssetManager"
  );
  const Erc20AssetManagerABI = await artifacts.readArtifact(
    "ERC20AssetManager"
  );

  // Contracts
  let registry, liquidator, priceFeed, vaultEngine;
  try {
    registry = new ethers.Contract(process.env.REGISTRY!, RegistryABI.abi, gov);
    liquidator = new ethers.Contract(
      process.env.LIQUIDATOR!,
      LiquidatorABI.abi,
      gov
    );
    priceFeed = new ethers.Contract(
      process.env.PRICE_FEED!,
      PriceFeedABI.abi,
      gov
    );
    vaultEngine = new ethers.Contract(
      process.env.VAULT_ENGINE!,
      VaultEngineABI.abi,
      gov
    );
  } catch (error) {
    console.log(error);
    process.exit();
  }

  try {
    // Allow a list of users to interact with the contracts
    for (const address of allowlist) {
      // Note: An address can only have one role at a time.
      // Note: governance address was set at deployment
      console.log(`Allowing address: ${address}`);
      try {
        let tx = await registry
          .connect(gov)
          .setupAddress(
            ethers.utils.formatBytes32String("whitelisted"),
            address,
            false,
            {
              gasLimit: 300000,
            }
          );
        await tx.wait();
      } catch (error) {
        console.log(`Error: ${error}`);
        process.exit();
      }
    }

    // Initialize the native token in VaultEngine
    console.log(`Initializing native token collateral: ${nativeToken}`);
    let category = 1; // collateral category code
    let tx = await vaultEngine
      .connect(gov)
      .initAsset(NATIVE_ASSETS[nativeToken], category, { gasLimit: 400000 });
    await tx.wait();
    console.log(`Vault: ${nativeToken} initialized`);

    // Initialize erc20Token in VaultEngine
    const erc20Token = "USD";
    console.log(`Initializing ${erc20Token} token`);
    category = 0; // underlying category code
    tx = await vaultEngine
      .connect(gov)
      .initAsset(ERC20_ASSETS[erc20Token], category, { gasLimit: 400000 });
    await tx.wait();
    console.log(`Vault: ${erc20Token} initialized`);

    // Limit songbird vault to 1000 USD
    if (networkName === "songbird") {
      const limit = 1000;
      tx = await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(RAD.mul(limit), {
          gasLimit: 300000,
        });
      await tx.wait();
      console.log(`Vault: individual limit set to ${limit} ${nativeToken}`);
    }

    // Update vault debt ceiling to 10M USD
    const ceiling = 10_000_000;
    tx = await vaultEngine
      .connect(gov)
      .updateCeiling(NATIVE_ASSETS[nativeToken], RAD.mul(ceiling), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: ceiling updated to ${ceiling} ${nativeToken}`);

    tx = await vaultEngine
      .connect(gov)
      .updateCeiling(ERC20_ASSETS[erc20Token], RAD.mul(ceiling), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: ceiling updated to ${ceiling} ${erc20Token}`);

    // Update vault debt floor to 1 USD
    const floor = 1;
    tx = await vaultEngine
      .connect(gov)
      .updateFloor(NATIVE_ASSETS[nativeToken], WAD.mul(floor), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: floor updated to ${floor} ${nativeToken}`);

    tx = await vaultEngine
      .connect(gov)
      .updateFloor(ERC20_ASSETS[erc20Token], WAD.mul(floor), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: floor updated to ${floor} ${erc20Token}`);

    // Initialize native token in Liquidator (sets default penalty fees)
    await liquidator
      .connect(gov)
      .callStatic.initAsset(
        NATIVE_ASSETS[nativeToken],
        process.env.AUCTIONEER,
        {
          gasLimit: 300000,
        }
      );
    tx = await liquidator
      .connect(gov)
      .initAsset(NATIVE_ASSETS[nativeToken], process.env.AUCTIONEER, {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Liquidator: ${nativeToken} initialized`);

    // Initialize native token price feed
    let liqRatio = WAD.mul(15).div(10); // 150%
    let args = [
      NATIVE_ASSETS[nativeToken],
      liqRatio,
      process.env.FTSO,
      { gasLimit: 300000 },
    ];
    await priceFeed.connect(gov).callStatic.initAsset(...args);
    tx = await priceFeed.connect(gov).initAsset(...args);
    await tx.wait();
    console.log(
      `PriceFeed: ${nativeToken} price initialized with ${ethers.utils
        .formatEther(liqRatio)
        .toString()} liq. ratio`
    );

    // Initialize erc20 token price feed
    liqRatio = WAD.mul(100).div(100); // must be < 100%
    args = [
      ERC20_ASSETS[erc20Token],
      liqRatio,
      process.env.FTSO,
      { gasLimit: 300000 },
    ];
    await priceFeed.connect(gov).callStatic.initAsset(...args);
    tx = await priceFeed.connect(gov).initAsset(...args);
    await tx.wait();
    console.log(
      `PriceFeed: ${erc20Token} price initialized with ${ethers.utils
        .formatEther(liqRatio)
        .toString()} liq. ratio`
    );

    // Fetch native token price
    tx = await priceFeed
      .connect(gov)
      .updateAdjustedPrice(NATIVE_ASSETS[nativeToken], { gasLimit: 300000 });
    await tx.wait();
    console.log(`PriceFeed: ${nativeToken} price updated`);

    // Fetch ERC20 token price
    tx = await priceFeed
      .connect(gov)
      .updateAdjustedPrice(ERC20_ASSETS[erc20Token], { gasLimit: 300000 });
    await tx.wait();
    console.log(`PriceFeed: ${erc20Token} price updated`);
  } catch (error) {
    console.log(error);
  }
};

init();
