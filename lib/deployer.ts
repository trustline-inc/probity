import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, network, web3 } from "hardhat";

// Import contract factory types
import {
  AureiFactory,
  TcnTokenFactory,
  RegistryFactory,
  VaultEngineFactory,
  NativeCollateralFactory,
  Erc20CollateralFactory,
  TellerFactory,
  TreasuryFactory,
  PriceFeedFactory,
  AuctioneerFactory,
  LinearDecreaseFactory,
  LiquidatorFactory,
  ReservePoolFactory,
  VpTokenCollateralFactory,
  HighAprFactory,
  LowAprFactory,
  MockFtsoFactory,
  MockFtsoManagerFactory,
  MockFtsoRewardManagerFactory,
  MockErc20TokenFactory,
  MockVpTokenFactory,
  MockVaultEngineFactory,
} from "../typechain";

// Import contract types
import {
  Aurei,
  Registry,
  TcnToken,
  VaultEngine,
  NativeCollateral,
  Erc20Collateral,
  Teller,
  Treasury,
  PriceFeed,
  Auctioneer,
  LinearDecrease,
  Liquidator,
  ReservePool,
  MockErc20Token,
  VpTokenCollateral,
  LowApr,
  HighApr,
  MockFtso,
  MockFtsoManager,
  MockFtsoRewardManager,
  MockVpToken,
  MockVaultEngine,
} from "../typechain";

/**
 * Set native token for the deployment's target network
 */
const NETWORK_NATIVE_TOKENS = {
  local: "FLR",
  hardhat: "FLR",
  coston: "CFLR",
  songbird: "SGB",
  flare: "FLR",
};

const NETWORK_NATIVE_TOKEN = NETWORK_NATIVE_TOKENS[network.name];

/**
 * Contracts
 */
interface Contracts {
  aurei: Aurei;
  ftso: MockFtso;
  registry: Registry;
  tcnToken: TcnToken;
  vaultEngine: VaultEngine;
  nativeCollateral: NativeCollateral;
  fxrpCollateral: Erc20Collateral;
  ftsoManager: MockFtsoManager;
  ftsoRewardManager: MockFtsoRewardManager;
  teller: Teller;
  treasury: Treasury;
  priceFeed: PriceFeed;
  auctioneer: Auctioneer;
  linearDecrease: LinearDecrease;
  liquidator: Liquidator;
  reserve: ReservePool;
  erc20: MockErc20Token;
  vpToken: MockVpToken;
  vpTokenCollateral: VpTokenCollateral;
  lowApr: LowApr;
  highApr: HighApr;
  mockVaultEngine: MockVaultEngine;
}

const contracts: Contracts = {
  aurei: null,
  ftso: null,
  registry: null,
  tcnToken: null,
  vaultEngine: null,
  nativeCollateral: null,
  fxrpCollateral: null,
  ftsoManager: null,
  ftsoRewardManager: null,
  teller: null,
  treasury: null,
  priceFeed: null,
  auctioneer: null,
  linearDecrease: null,
  liquidator: null,
  reserve: null,
  erc20: null,
  vpToken: null,
  vpTokenCollateral: null,
  lowApr: null,
  highApr: null,
  mockVaultEngine: null,
};

interface Signers {
  owner: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  charlie: SignerWithAddress;
  don: SignerWithAddress;
  lender: SignerWithAddress;
  borrower: SignerWithAddress;
  liquidator: SignerWithAddress;
  addrs: SignerWithAddress[];
}

const signers: Signers = {
  owner: null,
  alice: null,
  bob: null,
  charlie: null,
  don: null,
  lender: null,
  borrower: null,
  liquidator: null,
  addrs: null,
};

const getSigners = async () => {
  // Set signers
  [
    signers.owner,
    signers.alice,
    signers.bob,
    signers.charlie,
    signers.don,
    signers.lender,
    signers.borrower,
    signers.liquidator,
    ...signers.addrs
  ] = await ethers.getSigners();
  return signers;
};

const bytes32 = (string) => ethers.utils.formatBytes32String(string);

const deployRegistry = async (param?: { govAddress?: string }) => {
  const signers = await getSigners();
  const govAddress =
    param && param.govAddress ? param.govAddress : signers.owner.address;

  const registryFactory = (await ethers.getContractFactory(
    "Registry",
    signers.owner
  )) as RegistryFactory;
  contracts.registry = await registryFactory.deploy(govAddress);
  await contracts.registry.deployed();

  return contracts;
};

const deployAUR = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;

  // Set signers
  const signers = await getSigners();

  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as AureiFactory;
  contracts.aurei = await aureiFactory.deploy(registry);
  await contracts.aurei.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("aur"),
    contracts.aurei.address
  );

  return contracts;
};

const deployTCN = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  // Set signers
  const signers = await getSigners();

  const tcnFactory = (await ethers.getContractFactory(
    "TcnToken",
    signers.owner
  )) as TcnTokenFactory;
  contracts.tcnToken = await tcnFactory.deploy(registry);
  await contracts.tcnToken.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("tcn"),
    contracts.tcnToken.address
  );

  return contracts;
};

const deployApr = async () => {
  // Set signers
  const signers = await getSigners();

  const lowAprFactory = (await ethers.getContractFactory(
    "LowAPR",
    signers.owner
  )) as LowAprFactory;
  contracts.lowApr = await lowAprFactory.deploy();
  await contracts.lowApr.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("lowApr"),
    contracts.lowApr.address
  );

  const highAprFactory = (await ethers.getContractFactory(
    "HighAPR",
    signers.owner
  )) as HighAprFactory;
  contracts.highApr = await highAprFactory.deploy();
  await contracts.highApr.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("highApr"),
    contracts.highApr.address
  );

  return contracts;
};

const deployVaultEngine = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  // Set signers
  const signers = await getSigners();

  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngine",
    signers.owner
  )) as VaultEngineFactory;
  contracts.vaultEngine = await vaultEngineFactory.deploy(registry);
  await contracts.vaultEngine.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngine.address
  );

  return contracts;
};

const deployVPTokenCollateral = async (param?: {
  registry?: string;
  collateralId?: string;
  ftsoManager?: string;
  ftsoRewardManager?: string;
  vpToken?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const collateralId =
    param && param.collateralId
      ? param.collateralId
      : web3.utils.keccak256("VPToken");
  const ftsoManager =
    param && param.ftsoManager
      ? param.ftsoManager
      : contracts.ftsoManager.address;
  const ftsoRewardManager =
    param && param.ftsoRewardManager
      ? param.ftsoRewardManager
      : contracts.ftsoRewardManager.address;
  const vpToken =
    param && param.vpToken ? param.vpToken : contracts.vpToken.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const vpTokenCollateralFactory = (await ethers.getContractFactory(
    "VPTokenCollateral",
    signers.owner
  )) as VpTokenCollateralFactory;
  contracts.vpTokenCollateral = await vpTokenCollateralFactory.deploy(
    registry,
    collateralId,
    ftsoManager,
    ftsoRewardManager,
    vpToken,
    vaultEngine
  );
  await contracts.vpTokenCollateral.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.vpTokenCollateral.address
  );

  return contracts;
};

const deployERC20Collateral = async (param?: {
  registry?: string;
  collateralId?: string;
  erc20?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const collateralId =
    param && param.collateralId
      ? param.collateralId
      : web3.utils.keccak256("FXRP");
  const erc20 = param && param.erc20 ? param.erc20 : contracts.erc20.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const fxrpCollateralFactory = (await ethers.getContractFactory(
    "ERC20Collateral",
    signers.owner
  )) as Erc20CollateralFactory;
  contracts.fxrpCollateral = await fxrpCollateralFactory.deploy(
    registry,
    collateralId,
    erc20,
    vaultEngine
  );
  await contracts.fxrpCollateral.deployed();
  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.fxrpCollateral.address
  );
};

const deployNativeCollateral = async (param?: {
  registry?: string;
  collateralId?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const collateralId =
    param && param.collateralId
      ? param.collateralId
      : web3.utils.keccak256(NETWORK_NATIVE_TOKEN);
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;

  // Set signers
  const signers = await getSigners();

  const nativeCollateralFactory = (await ethers.getContractFactory(
    "NativeCollateral",
    signers.owner
  )) as NativeCollateralFactory;
  contracts.nativeCollateral = await nativeCollateralFactory.deploy(
    registry,
    collateralId,
    vaultEngine
  );
  await contracts.nativeCollateral.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.nativeCollateral.address
  );

  return contracts;
};

const deployTeller = async (param?: {
  registry?: string;
  vaultEngine?: string;
  lowApr?: string;
  highApr?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;
  const lowApr =
    param && param.lowApr ? param.lowApr : contracts.lowApr.address;
  const highApr =
    param && param.highApr ? param.highApr : contracts.highApr.address;

  // Set signers
  const signers = await getSigners();

  const tellerFactory = (await ethers.getContractFactory(
    "Teller",
    signers.owner
  )) as TellerFactory;
  contracts.teller = await tellerFactory.deploy(
    registry,
    vaultEngine,
    lowApr,
    highApr
  );
  await contracts.teller.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("teller"),
    contracts.teller.address
  );

  return contracts;
};

const deployTreasury = async (param?: {
  registry?: string;
  vaultEngine?: string;
  aurei?: string;
  tcnToken?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;
  const aurei = param && param.aurei ? param.aurei : contracts.aurei.address;
  const tcnToken =
    param && param.tcnToken ? param.tcnToken : contracts.tcnToken.address;
  // Set signers
  const signers = await getSigners();

  const treasuryFactory = (await ethers.getContractFactory(
    "Treasury",
    signers.owner
  )) as TreasuryFactory;

  contracts.treasury = await treasuryFactory.deploy(
    registry,
    aurei,
    tcnToken,
    vaultEngine
  );

  await contracts.treasury.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("treasury"),
    contracts.treasury.address
  );

  return contracts;
};

const deployPriceFeed = async (param?: {
  registry?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;

  // Set signers
  const signers = await getSigners();

  const priceFeedFactory = (await ethers.getContractFactory(
    "PriceFeed",
    signers.owner
  )) as PriceFeedFactory;
  contracts.priceFeed = await priceFeedFactory.deploy(registry, vaultEngine);
  await contracts.priceFeed.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("priceFeed"),
    contracts.priceFeed.address
  );

  return contracts;
};

const deployAuction = async (param?: {
  registry?: string;
  vaultEngine?: string;
  priceCalc?: string;
  ftso?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;
  const linearDecrease =
    param && param.priceCalc
      ? param.priceCalc
      : contracts.linearDecrease.address;
  const ftso = param && param.ftso ? param.ftso : contracts.ftso.address;
  // Set signers
  const signers = await getSigners();

  const auctionFactory = (await ethers.getContractFactory(
    "Auctioneer",
    signers.owner
  )) as AuctioneerFactory;
  contracts.auctioneer = await auctionFactory.deploy(
    registry,
    vaultEngine,
    linearDecrease,
    ftso
  );
  await contracts.auctioneer.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("auctioneer"),
    contracts.auctioneer.address
  );

  return contracts;
};

const deployPriceCalc = async () => {
  // Set signers
  const signers = await getSigners();

  const linearDecreaseFactory = (await ethers.getContractFactory(
    "LinearDecrease",
    signers.owner
  )) as LinearDecreaseFactory;
  contracts.linearDecrease = await linearDecreaseFactory.deploy();
  await contracts.linearDecrease.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("priceCalc"),
    contracts.linearDecrease.address
  );

  return contracts;
};

const deployReserve = async (param?: {
  registry?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const reserveFactory = (await ethers.getContractFactory(
    "ReservePool",
    signers.owner
  )) as ReservePoolFactory;
  contracts.reserve = await reserveFactory.deploy(registry, vaultEngine);

  await contracts.reserve.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("reserve"),
    contracts.reserve.address
  );

  return contracts;
};

const deployLiquidator = async (param?: {
  registry?: string;
  vaultEngine?: string;
  reserve?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : contracts.vaultEngine.address;
  const reserve =
    param && param.reserve ? param.reserve : contracts.reserve.address;

  const signers = await getSigners();

  const liquidatorFactory = (await ethers.getContractFactory(
    "Liquidator",
    signers.owner
  )) as LiquidatorFactory;
  contracts.liquidator = await liquidatorFactory.deploy(
    registry,
    vaultEngine,
    reserve
  );

  await contracts.liquidator.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("liquidator"),
    contracts.liquidator.address
  );

  return contracts;
};

const deployMockERC20 = async () => {
  const signers = await getSigners();

  const erc20Factory = (await ethers.getContractFactory(
    "MockERC20Token",
    signers.owner
  )) as MockErc20TokenFactory;
  contracts.erc20 = await erc20Factory.deploy();

  await contracts.erc20.deployed();

  return contracts;
};

const deployMockVPToken = async () => {
  const signers = await getSigners();

  const vpTokenFactory = (await ethers.getContractFactory(
    "MockVPToken",
    signers.owner
  )) as MockVpTokenFactory;
  contracts.vpToken = await vpTokenFactory.deploy();

  await contracts.vpToken.deployed();

  return contracts;
};

const deployMockVaultEngine = async () => {
  const signers = await getSigners();

  const mockVaultEngineFactory = (await ethers.getContractFactory(
    "MockVaultEngine",
    signers.owner
  )) as MockVaultEngineFactory;
  contracts.mockVaultEngine = await mockVaultEngineFactory.deploy();

  await contracts.mockVaultEngine.deployed();

  return contracts;
};

const deployMockFtso = async () => {
  // Set signers
  const signers = await getSigners();

  const ftsoFactory = (await ethers.getContractFactory(
    "MockFtso",
    signers.owner
  )) as MockFtsoFactory;
  contracts.ftso = await ftsoFactory.deploy();
  await contracts.ftso.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("ftso"),
    contracts.ftso.address
  );

  return contracts;
};

const deployMockFtsoManager = async () => {
  // Set signers
  const signers = await getSigners();

  const ftsoManagerFactory = (await ethers.getContractFactory(
    "MockFtsoManager",
    signers.owner
  )) as MockFtsoManagerFactory;
  contracts.ftsoManager = await ftsoManagerFactory.deploy();
  await contracts.ftsoManager.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("ftsoManager"),
    contracts.ftsoManager.address
  );

  return contracts;
};

const deployMockFtsoRewardManager = async () => {
  // Set signers
  const signers = await getSigners();

  const ftsoRewardManager = (await ethers.getContractFactory(
    "MockFtsoRewardManager",
    signers.owner
  )) as MockFtsoRewardManagerFactory;
  contracts.ftsoRewardManager = await ftsoRewardManager.deploy();
  await contracts.ftsoRewardManager.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("ftsoRewardManager"),
    contracts.ftsoRewardManager.address
  );

  return contracts;
};

const deployMocks = async () => {
  // Set signers
  const signers = await getSigners();
  await deployMockERC20();
  await deployMockVPToken();
  await deployMockFtso();
  await deployMockFtsoManager();
  await deployMockFtsoRewardManager();

  return { contracts, signers };
};

const deployProbity = async () => {
  // Set signers
  const signers = await getSigners();
  await deployAUR();
  await deployTCN();
  await deployApr();
  await deployVaultEngine();
  await deployNativeCollateral();
  await deployTeller();
  await deployPriceCalc();
  await deployPriceFeed();
  await deployTreasury();
  await deployReserve();
  await deployLiquidator();

  return { contracts, signers };
};

const deployLocal = async () => {
  const signers = await getSigners();
  await deployRegistry();
  await deployMocks();
  await deployProbity();
  await deployAuction();
  await deployERC20Collateral();
  await deployVPTokenCollateral();

  return { contracts, signers };
};

const deployTest = async () => {
  const signers = await getSigners();
  await deployRegistry();
  await deployMocks();
  await deployProbity();
  await deployAuction();
  await deployERC20Collateral();
  await deployVPTokenCollateral();
  await deployMockVaultEngine();

  return { contracts, signers };
};

const deployProd = async () => {
  const signers = await getSigners();
  await deployRegistry();
  await deployProbity();

  return { contracts, signers };
};

const probity = {
  deployRegistry,
  deployAUR,
  deployTCN,
  deployApr,
  deployVaultEngine,
  deployNativeCollateral,
  deployERC20Collateral,
  deployVPTokenCollateral,
  deployTeller,
  deployPriceCalc,
  deployPriceFeed,
  deployAuction,
  deployTreasury,
  deployReserve,
  deployLiquidator,
};

const mock = {
  deployMockERC20,
  deployMockVPToken,
  deployMockFtso,
  deployMockFtsoManager,
  deployMockFtsoRewardManager,
  deployMockVaultEngine,
};

export { deployLocal, deployProd, deployTest, probity, mock };
