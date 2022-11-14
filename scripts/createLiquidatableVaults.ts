/**
 * Creates vaults with assets that are up for auction
 */
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, web3 } from "hardhat";
import { Contract } from "ethers";
import { RAD, RAY, WAD } from "../test/utils/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// address: 0x11EeB875AAc42eEe7CB37668360206B0056F6eEd
const wallet = new ethers.Wallet(
  "fe71f9a709f31ac88a6cd2aea74bfd66e5b99169d1650cbe10fec163786c8671",
  new ethers.providers.JsonRpcProvider(hre.network.url)
);
const amount = RAD.mul(1_000_000);
const ethAssetId = web3.utils.keccak256("ETH");
const usdAssetId = web3.utils.keccak256("USD");

(async () => {
  console.log("PLEASE MAKE SURE priceUpdate script is turned OFF!!");

  const [
    admin,
    lender,
    borrower1,
    borrower2,
    borrower3,
    borrower4,
  ]: SignerWithAddress[] = await ethers.getSigners();
  const contracts = await getContracts(admin);

  await whiteListUsers(contracts, [
    lender,
    borrower1,
    borrower2,
    borrower3,
    borrower4,
  ]);

  await setNewAssetPrice(contracts, "150000");

  await createEquityPosition(contracts, lender, {
    underlying: WAD.mul(10000),
    equity: WAD.mul(10000),
  });

  await createDebtPosition(contracts, borrower1, {
    collateral: WAD.mul(2000),
    debt: WAD.mul(2000),
  });
  await createDebtPosition(contracts, borrower2, {
    collateral: WAD.mul(3000),
    debt: WAD.mul(3000),
  });
  await createDebtPosition(contracts, borrower3, {
    collateral: WAD.mul(2400),
    debt: WAD.mul(2400),
  });
  await createDebtPosition(contracts, borrower4, {
    collateral: WAD.mul(2000),
    debt: WAD.mul(2000),
  });

  await setNewAssetPrice(contracts, "100000");

  await liquidateVaults(contracts, [
    borrower1,
    borrower2,
    borrower3,
    borrower4,
  ]);
})();

const getContracts = async (admin: SignerWithAddress) => {
  const VaultEngineIssuerABI = await artifacts.readArtifact(
    "VaultEngineIssuer"
  );
  const TreasuryABI = await artifacts.readArtifact("Treasury");
  const vaultEngine = new Contract(
    process.env.VAULT_ENGINE!,
    VaultEngineIssuerABI.abi,
    admin
  );
  const treasury = new Contract(process.env.TREASURY!, TreasuryABI.abi, admin);

  const RegistryABI = await artifacts.readArtifact("Registry");

  // Contracts
  const registry = new ethers.Contract(
    process.env.REGISTRY!,
    RegistryABI.abi,
    admin
  );

  const AuctioneerABI = await artifacts.readArtifact("Auctioneer");

  // Contracts
  const auctioneer = new ethers.Contract(
    process.env.AUCTIONEER!,
    AuctioneerABI.abi,
    admin
  );

  const UsdABI = await artifacts.readArtifact("USD");

  // Contracts
  const usd = new ethers.Contract(process.env.USD!, UsdABI.abi, admin);

  const LiquidatorABI = await artifacts.readArtifact("Liquidator");

  // Contracts
  const liquidator = new ethers.Contract(
    process.env.LIQUIDATOR!,
    LiquidatorABI.abi,
    admin
  );

  const UsdManagerABI = await artifacts.readArtifact("ERC20AssetManager");

  // Contracts
  const usdManager = new ethers.Contract(
    process.env.USD_MANAGER!,
    UsdManagerABI.abi,
    admin
  );

  const NativeAssetManagerABI = await artifacts.readArtifact(
    "NativeAssetManager"
  );

  // Contracts
  const nativeAssetManager = new ethers.Contract(
    process.env.NATIVE_ASSET_MANAGER!,
    NativeAssetManagerABI.abi,
    admin
  );

  const PriceFeedABI = await artifacts.readArtifact("PriceFeed");
  const priceFeed = new ethers.Contract(
    process.env.PRICE_FEED!,
    PriceFeedABI.abi,
    admin
  );

  const FtsoABI = await artifacts.readArtifact("MockFtso");
  const ftso = new Contract(process.env.FTSO!, FtsoABI.abi, admin);

  return {
    treasury,
    vaultEngine,
    registry,
    usd,
    usdManager,
    nativeAssetManager,
    priceFeed,
    ftso,
    liquidator,
    auctioneer,
  };
};

const whiteListUsers = async (contracts, users: SignerWithAddress[]) => {
  for (let user of users) {
    const args = [
      ethers.utils.formatBytes32String("whitelisted"),
      user.address,
      false,
      { gasLimit: 300000 },
    ];
    await contracts.registry.callStatic.register(...args);
    const result = await contracts.registry.register(...args);

    await result.wait();

    console.log(
      `Successfully whitelisted ${user.address} on ${hre.network.name}!`
    );
  }
};

const fundUser = async (contracts, user: SignerWithAddress, amount) => {
  // Use callStatic to check for errors
  await contracts.vaultEngine.callStatic.modifySupply(
    user.address,
    amount.mul(RAY)
  );

  console.log(`Supply user ${user.address} with Funds`);
  await contracts.vaultEngine.modifySupply(user.address, amount.mul(RAY));

  await contracts.treasury.connect(wallet).withdrawSystemCurrency(amount);
};

const setNewAssetPrice = async (contracts, price) => {
  await contracts.ftso.setCurrentPrice(price);
  await contracts.priceFeed.updateAdjustedPrice(ethAssetId);
};

const liquidateVaults = async (contracts, users: SignerWithAddress[]) => {
  for (let user of users) {
    await contracts.liquidator.liquidateVault(ethAssetId, user.address);
  }
};

const createEquityPosition = async (
  contracts,
  user: SignerWithAddress,
  amount
) => {
  await fundUser(contracts, user, amount.underlying);

  await contracts.usd
    .connect(user)
    .approve(contracts.usdManager.address, amount.underlying);
  await contracts.usdManager.connect(user).deposit(amount.underlying);
  const assetPrice = (await contracts.vaultEngine.assets(usdAssetId))
    .adjustedPrice;
  const rateForEquity = await contracts.vaultEngine.rateForEquity();

  const equityAmount = amount.underlying.mul(assetPrice).div(rateForEquity);

  await contracts.vaultEngine
    .connect(user)
    .modifyEquity(usdAssetId, amount.underlying, equityAmount);
};

const createDebtPosition = async (
  contracts,
  user: SignerWithAddress,
  amount
) => {
  await contracts.nativeAssetManager
    .connect(user)
    .deposit({ value: amount.collateral });

  const assetPrice = (await contracts.vaultEngine.assets(ethAssetId))
    .adjustedPrice;
  const rateForDebt = await contracts.vaultEngine.rateForDebt();

  const vault = await contracts.vaultEngine.vaults(ethAssetId, user.address);
  const currentCollateral = vault.collateral;
  const currentDebt = vault.normDebt;
  const debtAmount = amount.collateral
    .add(currentCollateral)
    .mul(assetPrice)
    .div(rateForDebt);
  const debtAmountToIncrease = debtAmount.sub(currentDebt);

  await contracts.vaultEngine
    .connect(user)
    .modifyDebt(ethAssetId, amount.collateral, debtAmountToIncrease);
};
