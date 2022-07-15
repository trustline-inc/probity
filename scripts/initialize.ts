import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import * as hre from "hardhat";
import { artifacts, ethers, web3 } from "hardhat";
import getNativeToken from "../lib/getNativeToken";

const nativeToken: string = getNativeToken();
const networkName = hre.network.name;

const NATIVE_ASSETS = {
  CFLR: web3.utils.keccak256("CFLR"),
  FLR: web3.utils.keccak256("FLR"),
  SGB: web3.utils.keccak256("SGB"),
};

const ERC20_ASSETS = {
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
  const TRUSTLINE_INC = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";
  const allowlist = [TRUSTLINE_INC];

  // ABIs
  const RegistryABI = await artifacts.readArtifact("Registry");
  const LiquidatorABI = await artifacts.readArtifact("Liquidator");
  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const TellerABI = await artifacts.readArtifact("Teller");
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");
  const VaultEngineLimitedABI = await artifacts.readArtifact(
    "VaultEngineLimited"
  );

  // Contracts
  const registry = new ethers.Contract(
    process.env.REGISTRY!,
    RegistryABI.abi,
    gov
  );
  const liquidator = new ethers.Contract(
    process.env.LIQUIDATOR!,
    LiquidatorABI.abi,
    gov
  );
  const priceFeed = new ethers.Contract(
    process.env.PRICE_FEED!,
    PriceFeedABI.abi,
    gov
  );
  const teller = new ethers.Contract(process.env.TELLER!, TellerABI.abi, gov);
  const vaultEngine = new ethers.Contract(
    process.env.VAULT_ENGINE_S_B!
      ? process.env.VAULT_ENGINE_S_B!
      : process.env.VAULT_ENGINE!,
    process.env.VAULT_ENGINE_S_B
      ? VaultEngineLimitedABI.abi
      : VaultEngineABI.abi,
    gov
  );

  try {
    // Allow a list of users to interact with the contracts
    for (const address of allowlist) {
      // Note: An address can only have one role at a time.
      // Note: governance address was set at deployment
      console.log(`Allowing address: ${address}`);
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
    }

    // Initialize the native token in VaultEngine
    console.log(`Initializing native token ${nativeToken}`);
    let tx = await vaultEngine
      .connect(gov)
      .initAsset(NATIVE_ASSETS[nativeToken], { gasLimit: 400000 });
    await tx.wait();
    console.log(`Vault: ${nativeToken} initialized`);

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

    // Update vault debt floor to 1 USD
    const floor = 1;
    tx = await vaultEngine
      .connect(gov)
      .updateFloor(NATIVE_ASSETS[nativeToken], WAD.mul(floor), {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Vault: floor updated to ${floor} ${nativeToken}`);

    // Initialize native token in Teller (sets default protocol fee)
    tx = await teller
      .connect(gov)
      .initAsset(NATIVE_ASSETS[nativeToken], 0, { gasLimit: 300000 });
    await tx.wait();
    console.log(`Teller: ${nativeToken} initialized`);

    // Initialize native token in Liquidator (sets default penalty fees)
    tx = await liquidator
      .connect(gov)
      .initAsset(NATIVE_ASSETS[nativeToken], process.env.AUCTIONEER, {
        gasLimit: 300000,
      });
    await tx.wait();
    console.log(`Liquidator: ${nativeToken} initialized`);

    // Initialize native token price feed
    const liqRatio = WAD.mul(15).div(10);
    tx = await priceFeed
      .connect(gov)
      .initAsset(NATIVE_ASSETS[nativeToken], liqRatio, process.env.FTSO, {
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
      .connect(gov)
      .updateAdjustedPrice(NATIVE_ASSETS[nativeToken], { gasLimit: 300000 });
    await tx.wait();
    console.log(`PriceFeed: ${nativeToken} price updated`);
  } catch (error) {
    console.log(error);
  }
};

init();
