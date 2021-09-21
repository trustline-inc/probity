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

const initialize = async () => {
  // Wallets
  const signers: SignerWithAddress[] = await ethers.getSigners();
  console.log(signers);

  // ABIs
  const NativeCollateralABI = await artifacts.readArtifact("NativeCollateral");
  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const TellerABI = await artifacts.readArtifact("Teller");
  const VaultABI = await artifacts.readArtifact("Vault");

  // Contracts
  const flrColl = new ethers.Contract(
    process.env.FLARE_COLLATERAL,
    NativeCollateralABI.abi,
    signers[0]
  );
  const priceFeed = new ethers.Contract(
    process.env.PRICE_FEED,
    PriceFeedABI.abi,
    signers[0]
  );
  const teller = new ethers.Contract(
    process.env.TELLER,
    TellerABI.abi,
    signers[0]
  );
  const vault = new ethers.Contract(
    process.env.VAULT,
    VaultABI.abi,
    signers[0]
  );

  // // FLR Collateral
  await flrColl
    .connect(signers[0])
    .deposit({ value: PRECISION_COLL.mul(1000) });

  // // Initialize FLR collateral type
  await vault.initCollType(COLLATERAL_ID["FLR"]);
  await vault.updateCeiling(COLLATERAL_ID["FLR"], PRECISION_AUR.mul(10000000));
  await teller.initCollType(COLLATERAL_ID["FLR"]);
  await priceFeed.init(
    COLLATERAL_ID["FLR"],
    PRECISION_COLL.mul(150),
    process.env.FTSO_ADDRESS
  );
  await priceFeed.updatePrice(COLLATERAL_ID["FLR"]);
};

initialize();
