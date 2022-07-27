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
};

init();
