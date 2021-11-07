import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// Collateral IDs
const COLLATERAL_ID = {
  FLR: web3.utils.keccak256("FLR"),
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
  const NativeCollateralABI = await artifacts.readArtifact("NativeCollateral");
  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const TellerABI = await artifacts.readArtifact("Teller");
  const VaultEngineABI = await artifacts.readArtifact("VaultEngine");

  // Contracts
  const nativeCollateral = new ethers.Contract(
    process.env.NATIVE_COLLATERAL,
    NativeCollateralABI.abi,
    owner
  );
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

  // // Initialize FLR collateral type
  console.log("Initializing FLR collateral type");
  await vaultEngine.connect(owner).initCollType(COLLATERAL_ID["FLR"]);
  console.log("Connected to vault, FLR initialized.");
  await vaultEngine
    .connect(owner)
    .updateCeiling(COLLATERAL_ID["FLR"], PRECISION_AUR.mul(10000000));
  console.log("Connected to vault, ceiling updated.");
  await teller
    .connect(owner)
    .initCollType(COLLATERAL_ID["FLR"], 0, { gasLimit: 300000 });
  console.log("Connected to teller, FLR initialized.");
  await priceFeed
    .connect(owner)
    .init(COLLATERAL_ID["FLR"], PRECISION_COLL.mul(150), process.env.FTSO);
  console.log("Connected to price feed, FLR price initialized.");
  await priceFeed
    .connect(owner)
    .updatePrice(COLLATERAL_ID["FLR"], { gasLimit: 300000 });
  console.log("Connected to price feed, FLR price updated.");
};

init();
