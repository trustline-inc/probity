import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import * as hre from "hardhat";
import { artifacts, ethers, web3 } from "hardhat";
import getNativeToken from "../lib/getNativeToken";
import { ASSET_ID, bytes32 } from "../test/utils/constants";

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize the system into a ready state
 */
const init = async () => {
  // Wallets
  const [gov, treasury, user]: SignerWithAddress[] = await ethers.getSigners();
  const TRUSTLINE_INC = "0x6310B7E8bDFD25EFbeDfB17987Ba69D9191a45bD";
  const allowlist = [TRUSTLINE_INC];

  // ABIs
  const RegistryABI = await artifacts.readArtifact("Registry");
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");
  const ERC20TokenABI = await artifacts.readArtifact("MockErc20Token");
  const ERC20AssetManagerABI = await artifacts.readArtifact(
    "ERC20AssetManager"
  );

  const registry = new ethers.Contract(
    process.env.REGISTRY!,
    RegistryABI.abi,
    gov
  );

  const USD_MANAGER = new ethers.Contract(
    process.env.USD_MANAGER,
    ERC20AssetManagerABI.abi,
    gov
  );

  const USD = new ethers.Contract(process.env.USD, ERC20TokenABI.abi, gov);

  const vaultEngine = new ethers.Contract(
    process.env.VAULT_ENGINE,
    VaultEngineABI.abi,
    gov
  );

  // await registry.connect(gov).setupAddress(bytes32("treasury"), treasury.address, true);
  // await registry.connect(gov).setupAddress(bytes32("whitelisted"), user.address, false);
  // await sleep(5000)
  // await USD.connect(treasury).mint(user.address, WAD.mul(1_000_000))
  // await sleep(5000)
  // await USD.connect(user).approve(process.env.USD_MANAGER, WAD.mul(1_000_000))
  // await sleep(5000)
  // await USD_MANAGER.connect(user).deposit(WAD.mul(100))
  // await sleep(5000)
  // const res = await USD.balanceOf(user.address)

  try {
    const res = await vaultEngine.vaults(bytes32("USD"), user.address);
    console.log(res);

    // const tx = await vaultEngine.connect(user).modifyEquity(bytes32("USD"), process.env.TREASURY, WAD.mul(100), WAD.mul(100))
    // const result = await tx.wait();
    // console.log(result);
  } catch (error) {
    console.log(error);
  }
};

init();
