import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, network, web3 } from "hardhat";

export type Deployment = {
  contracts: ContractDict;
  signers: SignerDict;
};

// Import contract types
import {
  Aurei,
  Phi,
  Registry,
  PbtToken,
  VaultEngine,
  NativeCollateral,
  ERC20Collateral,
  Teller,
  Treasury,
  PriceFeed,
  Auctioneer,
  LinearDecrease,
  Liquidator,
  ReservePool,
  MockERC20Token,
  VPTokenCollateral,
  LowAPR,
  HighAPR,
  Shutdown,
  MockFtso,
  MockFtsoManager,
  MockFtsoRewardManager,
  MockVPToken,
  MockVaultEngine,
  MockPriceFeed,
  MockAuctioneer,
  MockLiquidator,
  MockReservePool,
  Registry__factory,
  Aurei__factory,
  Phi__factory,
  PbtToken__factory,
  LowAPR__factory,
  HighAPR__factory,
  VaultEngine__factory,
  VPTokenCollateral__factory,
  ERC20Collateral__factory,
  NativeCollateral__factory,
  Teller__factory,
  Treasury__factory,
  PriceFeed__factory,
  Auctioneer__factory,
  LinearDecrease__factory,
  ReservePool__factory,
  Shutdown__factory,
  Liquidator__factory,
  MockERC20Token__factory,
  MockVPToken__factory,
  MockVaultEngine__factory,
  MockFtso__factory,
  MockFtsoManager__factory,
  MockFtsoRewardManager__factory,
  MockAuctioneer__factory,
  MockLiquidator__factory,
  MockPriceFeed__factory,
  MockReservePool__factory,
  VaultEngineSB,
  VaultEngineSB__factory,
} from "../typechain";

/**
 * Set native token for the deployment's target network
 */
const NETWORK_NATIVE_TOKENS = {
  local: "FLR",
  hardhat: "FLR",
  coston: "FLR",
  songbird: "SGB",
  flare: "FLR",
};

const NETWORK_NATIVE_TOKEN = NETWORK_NATIVE_TOKENS[network.name];

/**
 * Contracts
 */
interface ContractDict {
  aurei: Aurei;
  phi: Phi;
  ftso: MockFtso;
  registry: Registry;
  pbtToken: PbtToken;
  vaultEngine: VaultEngine;
  vaultEngineSB: VaultEngineSB;
  nativeCollateral: NativeCollateral;
  erc20Collateral: ERC20Collateral;
  ftsoManager: MockFtsoManager;
  ftsoRewardManager: MockFtsoRewardManager;
  teller: Teller;
  treasury: Treasury;
  priceFeed: PriceFeed;
  auctioneer: Auctioneer;
  linearDecrease: LinearDecrease;
  liquidator: Liquidator;
  reservePool: ReservePool;
  erc20Token: MockERC20Token;
  shutdown: Shutdown;
  vpToken: MockVPToken;
  vpTokenCollateral: VPTokenCollateral;
  lowApr: LowAPR;
  highApr: HighAPR;
  mockVaultEngine: MockVaultEngine;
  mockPriceFeed: MockPriceFeed;
  mockAuctioneer: MockAuctioneer;
  mockLiquidator: MockLiquidator;
  mockReserve: MockReservePool;
}

const contracts: ContractDict = {
  aurei: null,
  phi: null,
  ftso: null,
  registry: null,
  pbtToken: null,
  vaultEngine: null,
  vaultEngineSB: null,
  nativeCollateral: null,
  erc20Collateral: null,
  ftsoManager: null,
  ftsoRewardManager: null,
  teller: null,
  treasury: null,
  priceFeed: null,
  auctioneer: null,
  linearDecrease: null,
  liquidator: null,
  reservePool: null,
  erc20Token: null,
  vpToken: null,
  vpTokenCollateral: null,
  shutdown: null,
  lowApr: null,
  highApr: null,
  mockVaultEngine: null,
  mockPriceFeed: null,
  mockAuctioneer: null,
  mockLiquidator: null,
  mockReserve: null,
};

interface SignerDict {
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

const signers: SignerDict = {
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
  )) as Registry__factory;
  contracts.registry = await registryFactory.deploy(govAddress);
  await contracts.registry.deployed();
  if (process.env.NODE_ENV !== "test") console.info("registry deployed ✓");
  return contracts;
};

const deployAurei = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as Aurei__factory;
  contracts.aurei = await aureiFactory.deploy(registry);
  await contracts.aurei.deployed();
  if (process.env.NODE_ENV !== "test") console.info("aurei deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("aur"),
    contracts.aurei.address
  );
  return contracts;
};

const deployPhi = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const phiFactory = (await ethers.getContractFactory(
    "Phi",
    signers.owner
  )) as Phi__factory;
  contracts.phi = await phiFactory.deploy(registry);
  await contracts.phi.deployed();
  if (process.env.NODE_ENV !== "test") console.info("phi deployed ✓");
  await contracts.registry.setupAddress(bytes32("phi"), contracts.phi.address);
  return contracts;
};

const deployPbt = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const pbtFactory = (await ethers.getContractFactory(
    "PbtToken",
    signers.owner
  )) as PbtToken__factory;
  contracts.pbtToken = await pbtFactory.deploy(registry);
  await contracts.pbtToken.deployed();
  if (process.env.NODE_ENV !== "test") console.info("pbt deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("pbt"),
    contracts.pbtToken.address
  );
  return contracts;
};

const deployApr = async () => {
  const signers = await getSigners();
  const lowAprFactory = (await ethers.getContractFactory(
    "LowAPR",
    signers.owner
  )) as LowAPR__factory;
  contracts.lowApr = await lowAprFactory.deploy();
  await contracts.lowApr.deployed();
  await contracts.registry.setupAddress(
    bytes32("lowApr"),
    contracts.lowApr.address
  );
  const highAprFactory = (await ethers.getContractFactory(
    "HighAPR",
    signers.owner
  )) as HighAPR__factory;
  contracts.highApr = await highAprFactory.deploy();
  await contracts.highApr.deployed();
  if (process.env.NODE_ENV !== "test") console.info("highApr deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("highApr"),
    contracts.highApr.address
  );
  return contracts;
};

const deployVaultEngine = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngine",
    signers.owner
  )) as VaultEngine__factory;
  contracts.vaultEngine = await vaultEngineFactory.deploy(registry);
  await contracts.vaultEngine.deployed();
  if (process.env.NODE_ENV !== "test") console.info("vaultEngine deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngine.address
  );
  return contracts;
};

const deployVaultEngineSB = async (param?: { registry?: string }) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngineSB",
    signers.owner
  )) as VaultEngineSB__factory;
  contracts.vaultEngineSB = await vaultEngineFactory.deploy(registry);
  await contracts.vaultEngineSB.deployed();
  if (process.env.NODE_ENV !== "test") console.info("vaultEngineSB deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngineSB.address
  );
  return contracts;
};

const deployVPTokenCollateral = async (param?: {
  registry?: Registry;
  collateralId?: string;
  ftsoManager?: string;
  ftsoRewardManager?: string;
  vpToken?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry;
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
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const vpTokenCollateralFactory = (await ethers.getContractFactory(
    "VPTokenCollateral",
    signers.owner
  )) as VPTokenCollateral__factory;
  contracts.vpTokenCollateral = await vpTokenCollateralFactory.deploy(
    registry.address,
    collateralId,
    ftsoManager,
    ftsoRewardManager,
    vpToken,
    vaultEngine
  );
  await contracts.vpTokenCollateral.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("vpTokenCollateral deployed ✓");

  await registry.setupAddress(
    bytes32("collateral"),
    contracts.vpTokenCollateral.address
  );

  return contracts;
};

const deployERC20Collateral = async (param?: {
  registry?: Registry;
  collateralId?: string;
  erc20?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry;
  const collateralId =
    param && param.collateralId
      ? param.collateralId
      : web3.utils.keccak256("FXRP");
  const erc20Token =
    param && param.erc20 ? param.erc20 : contracts.erc20Token.address;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const erc20CollateralFactory = (await ethers.getContractFactory(
    "ERC20Collateral",
    signers.owner
  )) as ERC20Collateral__factory;
  contracts.erc20Collateral = await erc20CollateralFactory.deploy(
    registry.address,
    collateralId,
    erc20Token,
    vaultEngine
  );
  await contracts.erc20Collateral.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("erc20Collateral deployed ✓");

  await registry.setupAddress(
    bytes32("collateral"),
    contracts.erc20Collateral.address
  );

  return contracts;
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
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const nativeCollateralFactory = (await ethers.getContractFactory(
    "NativeCollateral",
    signers.owner
  )) as NativeCollateral__factory;
  contracts.nativeCollateral = await nativeCollateralFactory.deploy(
    registry,
    collateralId,
    vaultEngine
  );
  await contracts.nativeCollateral.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("nativeCollateral deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("collateral"),
    contracts.nativeCollateral.address
  );

  return contracts;
};

const deployShutdown = async (param?: {
  registry?: string;
  priceFeed?: string;
  vaultEngine?: string;
  reservePool?: string;
  teller?: string;
  treasury?: string;
  liquidator?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const priceFeed =
    param && param.priceFeed ? param.priceFeed : contracts.priceFeed.address;
  const reservePool =
    param && param.reservePool
      ? param.reservePool
      : contracts.reservePool.address;
  const teller =
    param && param.teller ? param.teller : contracts.teller.address;
  const treasury =
    param && param.treasury ? param.treasury : contracts.treasury.address;
  const liquidator =
    param && param.liquidator ? param.liquidator : contracts.liquidator.address;

  // Set signers
  const signers = await getSigners();

  const shutdownFactory = (await ethers.getContractFactory(
    "Shutdown",
    signers.owner
  )) as Shutdown__factory;
  contracts.shutdown = await shutdownFactory.deploy(
    registry,
    priceFeed,
    vaultEngine,
    reservePool,
    teller,
    treasury,
    liquidator
  );
  await contracts.shutdown.deployed();
  if (process.env.NODE_ENV !== "test") console.info("shutdown deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("shutdown"),
    contracts.shutdown.address
  );

  return contracts;
};

const deployTeller = async (param?: {
  registry?: string;
  vaultEngine?: string;
  lowApr?: string;
  highApr?: string;
  reservePool?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const lowApr =
    param && param.lowApr ? param.lowApr : contracts.lowApr.address;
  const highApr =
    param && param.highApr ? param.highApr : contracts.highApr.address;
  const reservePool =
    param && param.reservePool
      ? param.reservePool
      : contracts.reservePool.address;

  const signers = await getSigners();

  const tellerFactory = (await ethers.getContractFactory(
    "Teller",
    signers.owner
  )) as Teller__factory;
  contracts.teller = await tellerFactory.deploy(
    registry,
    vaultEngine,
    reservePool,
    lowApr,
    highApr
  );
  await contracts.teller.deployed();
  if (process.env.NODE_ENV !== "test") console.info("teller deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("teller"),
    contracts.teller.address
  );

  return contracts;
};

const deployTreasury = async (param?: {
  registry?: string;
  vaultEngine?: string;
  token?: string;
  pbtToken?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const token = param && param.token ? param.token : contracts.aurei.address;
  const pbtToken =
    param && param.pbtToken ? param.pbtToken : contracts.pbtToken.address;
  const signers = await getSigners();

  const treasuryFactory = (await ethers.getContractFactory(
    "Treasury",
    signers.owner
  )) as Treasury__factory;
  contracts.treasury = await treasuryFactory.deploy(
    registry,
    token,
    pbtToken,
    vaultEngine
  );

  await contracts.treasury.deployed();
  if (process.env.NODE_ENV !== "test") console.info("treasury deployed ✓");

  await contracts.registry.setupAddress(
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
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const priceFeedFactory = (await ethers.getContractFactory(
    "PriceFeed",
    signers.owner
  )) as PriceFeed__factory;
  contracts.priceFeed = await priceFeedFactory.deploy(registry, vaultEngine);
  await contracts.priceFeed.deployed();
  if (process.env.NODE_ENV !== "test") console.info("priceFeed deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("priceFeed"),
    contracts.priceFeed.address
  );

  return contracts;
};

const deployAuctioneer = async (param?: {
  registry?: Registry;
  vaultEngine?: string;
  priceCalc?: string;
  ftso?: string;
  liquidator?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const linearDecrease =
    param && param.priceCalc
      ? param.priceCalc
      : contracts.linearDecrease.address;
  const ftso = param && param.ftso ? param.ftso : contracts.ftso.address;
  const liquidator =
    param && param.liquidator ? param.liquidator : contracts.liquidator.address;
  const signers = await getSigners();

  const auctioneerFactory = (await ethers.getContractFactory(
    "Auctioneer",
    signers.owner
  )) as Auctioneer__factory;
  contracts.auctioneer = await auctioneerFactory.deploy(
    registry.address,
    vaultEngine,
    linearDecrease,
    ftso,
    liquidator
  );

  await contracts.auctioneer.deployed();
  if (process.env.NODE_ENV !== "test") console.info("auctioneer deployed ✓");

  await registry.setupAddress(
    bytes32("auctioneer"),
    contracts.auctioneer.address
  );

  return contracts;
};

const deployPriceCalc = async () => {
  const signers = await getSigners();
  const linearDecreaseFactory = (await ethers.getContractFactory(
    "LinearDecrease",
    signers.owner
  )) as LinearDecrease__factory;
  contracts.linearDecrease = await linearDecreaseFactory.deploy();
  await contracts.linearDecrease.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("linearDecrease deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("priceCalc"),
    contracts.linearDecrease.address
  );
  return contracts;
};

const deployReservePool = async (param?: {
  registry?: string;
  vaultEngine?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();
  const reservePoolFactory = (await ethers.getContractFactory(
    "ReservePool",
    signers.owner
  )) as ReservePool__factory;
  contracts.reservePool = await reservePoolFactory.deploy(
    registry,
    vaultEngine
  );
  await contracts.reservePool.deployed();
  if (process.env.NODE_ENV !== "test") console.info("reservePool deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("reservePool"),
    contracts.reservePool.address
  );

  return contracts;
};

const deployLiquidator = async (param?: {
  registry?: string;
  vaultEngine?: string;
  reservePool?: string;
}) => {
  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param?.vaultEngine || process.env.TOKEN?.toLowerCase() === "phi"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const reservePool =
    param && param.reservePool
      ? param.reservePool
      : contracts.reservePool.address;

  const signers = await getSigners();
  const liquidatorFactory = (await ethers.getContractFactory(
    "Liquidator",
    signers.owner
  )) as Liquidator__factory;
  contracts.liquidator = await liquidatorFactory.deploy(
    registry,
    vaultEngine,
    reservePool
  );
  await contracts.liquidator.deployed();
  if (process.env.NODE_ENV !== "test") console.info("liquidator deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("liquidator"),
    contracts.liquidator.address
  );

  return contracts;
};

const deployMockERC20 = async () => {
  const signers = await getSigners();
  const erc20TokenFactory = (await ethers.getContractFactory(
    "MockERC20Token",
    signers.owner
  )) as MockERC20Token__factory;
  contracts.erc20Token = await erc20TokenFactory.deploy();
  await contracts.erc20Token.deployed();
  return contracts;
};

const deployMockVPToken = async () => {
  const signers = await getSigners();
  const vpTokenFactory = (await ethers.getContractFactory(
    "MockVPToken",
    signers.owner
  )) as MockVPToken__factory;
  contracts.vpToken = await vpTokenFactory.deploy();
  await contracts.vpToken.deployed();
  if (process.env.NODE_ENV !== "test") console.info("vpToken deployed ✓");
  return contracts;
};

const deployMockVaultEngine = async () => {
  const signers = await getSigners();
  const mockVaultEngineFactory = (await ethers.getContractFactory(
    "MockVaultEngine",
    signers.owner
  )) as MockVaultEngine__factory;
  contracts.mockVaultEngine = await mockVaultEngineFactory.deploy();
  await contracts.mockVaultEngine.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("mockVaultEngine deployed ✓");
  return contracts;
};

const deployMockFtso = async () => {
  const signers = await getSigners();
  const ftsoFactory = (await ethers.getContractFactory(
    "MockFtso",
    signers.owner
  )) as MockFtso__factory;
  contracts.ftso = await ftsoFactory.deploy();
  await contracts.ftso.deployed();
  if (process.env.NODE_ENV !== "test") console.info("ftso deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("ftso"),
    contracts.ftso.address
  );
  return contracts;
};

const deployMockFtsoManager = async () => {
  const signers = await getSigners();
  const ftsoManagerFactory = (await ethers.getContractFactory(
    "MockFtsoManager",
    signers.owner
  )) as MockFtsoManager__factory;
  contracts.ftsoManager = await ftsoManagerFactory.deploy();
  await contracts.ftsoManager.deployed();
  if (process.env.NODE_ENV !== "test") console.info("ftsoManager deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("ftsoManager"),
    contracts.ftsoManager.address
  );
  return contracts;
};

const deployMockFtsoRewardManager = async () => {
  const signers = await getSigners();

  const ftsoRewardManager = (await ethers.getContractFactory(
    "MockFtsoRewardManager",
    signers.owner
  )) as MockFtsoRewardManager__factory;
  contracts.ftsoRewardManager = await ftsoRewardManager.deploy();
  await contracts.ftsoRewardManager.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("ftsoRewardManager deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("ftsoRewardManager"),
    contracts.ftsoRewardManager.address
  );

  return contracts;
};

const deployMockPriceFeed = async () => {
  // Set signers
  const signers = await getSigners();

  const mockPriceFeed = (await ethers.getContractFactory(
    "MockPriceFeed",
    signers.owner
  )) as MockPriceFeed__factory;
  contracts.mockPriceFeed = await mockPriceFeed.deploy();
  await contracts.mockPriceFeed.deployed();
  if (process.env.NODE_ENV !== "test") console.info("mockPriceFeed deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("priceFeed"),
    contracts.mockPriceFeed.address
  );

  return contracts;
};

const deployMockLiquidator = async () => {
  // Set signers
  const signers = await getSigners();

  const mockLiquidator = (await ethers.getContractFactory(
    "MockLiquidator",
    signers.owner
  )) as MockLiquidator__factory;
  contracts.mockLiquidator = await mockLiquidator.deploy();
  await contracts.mockLiquidator.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("mockLiquidator deployed ✓");
  await contracts.registry.setupAddress(
    bytes32("liquidator"),
    contracts.mockLiquidator.address
  );

  return contracts;
};

const deployMockAuctioneer = async () => {
  // Set signers
  const signers = await getSigners();

  const mockAuctioneer = (await ethers.getContractFactory(
    "MockAuctioneer",
    signers.owner
  )) as MockAuctioneer__factory;
  contracts.mockAuctioneer = await mockAuctioneer.deploy();
  await contracts.mockAuctioneer.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("mockAuctioneer deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("auctioneer"),
    contracts.mockAuctioneer.address
  );

  return contracts;
};

const deployMockReservePool = async () => {
  // Set signers
  const signers = await getSigners();

  const mockReserve = (await ethers.getContractFactory(
    "MockReservePool",
    signers.owner
  )) as MockReservePool__factory;
  contracts.mockReserve = await mockReserve.deploy();
  await contracts.mockReserve.deployed();
  if (process.env.NODE_ENV !== "test") console.info("mockReserve deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("reservePool"),
    contracts.mockReserve.address
  );

  return contracts;
};

const deployMocks = async () => {
  const signers = await getSigners();
  await deployMockERC20();
  await deployMockVPToken();
  await deployMockFtso();
  await deployMockFtsoManager();
  await deployMockFtsoRewardManager();
  await deployMockPriceFeed();
  await deployMockReservePool();
  await deployMockAuctioneer();
  await deployMockLiquidator();

  return { contracts, signers };
};

const deployProbity = async (token?: string) => {
  const signers = await getSigners();
  if (token && !["aurei", "phi"].includes(token))
    throw Error('Token must be either "aurei" or "phi".');
  token = token === undefined ? "aurei" : token;
  let contracts = token === "aurei" ? await deployAurei() : await deployPhi();
  await deployPbt();
  await deployApr();
  contracts =
    token === "aurei" ? await deployVaultEngine() : await deployVaultEngineSB();
  await deployNativeCollateral();
  await deployReservePool();
  await deployTeller();
  await deployPriceCalc();
  await deployPriceFeed();
  await deployTreasury({ token: contracts[token.toLowerCase()].address });
  await deployLiquidator();
  await deployShutdown();

  return { contracts, signers };
};

////
// Deployments by environment
////

const deployLocal = async (token?: string) => {
  const signers = await getSigners();
  await deployRegistry();
  await deployMocks();
  await deployProbity(token);
  await deployAuctioneer();
  await deployERC20Collateral();
  await deployVPTokenCollateral();
  return { contracts, signers };
};

const deployTest = async (token?: string) => {
  const signers = await getSigners();
  await deployRegistry();
  await deployMocks();
  await deployProbity(token);
  await deployVaultEngineSB();
  await deployAuctioneer();
  await deployERC20Collateral();
  await deployVPTokenCollateral();
  await deployMockVaultEngine();
  return { contracts, signers };
};

const deployProd = async (token?: string) => {
  const signers = await getSigners();
  await deployRegistry();
  await deployProbity(token);
  return { contracts, signers };
};

const probity = {
  deployRegistry,
  deployAurei,
  deployPbt,
  deployApr,
  deployVaultEngine,
  deployNativeCollateral,
  deployERC20Collateral,
  deployVPTokenCollateral,
  deployTeller,
  deployPriceCalc,
  deployPriceFeed,
  deployAuctioneer,
  deployTreasury,
  deployReservePool,
  deployLiquidator,
  deployShutdown,
};

const mock = {
  deployMockERC20,
  deployMockVPToken,
  deployMockFtso,
  deployMockFtsoManager,
  deployMockFtsoRewardManager,
  deployMockVaultEngine,
  deployMockPriceFeed,
};

export { deployLocal, deployProd, deployTest, probity, mock };
