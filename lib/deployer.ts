import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, network, web3 } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

export type Deployment = {
  contracts: ContractDict;
  signers: SignerDict;
};

// Import contract types
import {
  Aurei,
  BondIssuer,
  Phi,
  Registry,
  PbtToken,
  VaultEngine,
  VaultEngineSB,
  VaultEngineCoston,
  NativeAssetManager,
  ERC20AssetManager,
  Teller,
  Treasury,
  PriceFeed,
  Auctioneer,
  LinearDecrease,
  Liquidator,
  ReservePool,
  MockERC20AssetManager,
  VPAssetManager,
  LowAPR,
  HighAPR,
  Shutdown,
  MockFtso,
  MockFtsoManager,
  MockFtsoRewardManager,
  MockVPToken,
  MockVaultEngine,
  MockPriceFeed,
  MockPriceCalc,
  MockAuctioneer,
  MockLiquidator,
  MockReservePool,
  MockBondIssuer,
  Registry__factory,
  Aurei__factory,
  BondIssuer__factory,
  Phi__factory,
  PbtToken__factory,
  LowAPR__factory,
  HighAPR__factory,
  VaultEngine__factory,
  VaultEngineCoston__factory,
  VPAssetManager__factory,
  ERC20AssetManager__factory,
  NativeAssetManager__factory,
  Teller__factory,
  Treasury__factory,
  PriceFeed__factory,
  Auctioneer__factory,
  LinearDecrease__factory,
  ReservePool__factory,
  Shutdown__factory,
  Liquidator__factory,
  MockERC20AssetManager__factory,
  MockVPToken__factory,
  MockVaultEngine__factory,
  MockFtso__factory,
  MockFtsoManager__factory,
  MockFtsoRewardManager__factory,
  MockAuctioneer__factory,
  MockLiquidator__factory,
  MockPriceFeed__factory,
  MockPriceCalc__factory,
  MockReservePool__factory,
  MockBondIssuer__factory,
  VaultEngineSB__factory,
} from "../typechain";
import { ADDRESS_ZERO } from "../test/utils/constants";

/**
 * Set native token for the deployment's target network
 */
const NETWORK_NATIVE_TOKENS = {
  local: process.env.NATIVE_TOKEN_LOCAL || "FLR",
  hardhat: "FLR", // tests always use FLR and AUR
  internal: process.env.NATIVE_TOKEN_INTERNAL || "FLR",
  coston: process.env.NATIVE_TOKEN_COSTON || "CFLR",
  songbird: "SGB",
  flare: "FLR",
};

const NETWORK_NATIVE_TOKEN = NETWORK_NATIVE_TOKENS[network.name];

/**
 * Contracts
 */
interface ContractDict {
  aurei: Aurei;
  bondIssuer: BondIssuer;
  phi: Phi;
  ftso: MockFtso;
  registry: Registry;
  pbtToken: PbtToken;
  vaultEngine: VaultEngine;
  vaultEngineSB: VaultEngineSB;
  vaultEngineCoston: VaultEngineCoston;
  nativeAssetManager: NativeAssetManager;
  erc20AssetManager: ERC20AssetManager;
  ftsoManager: MockFtsoManager;
  ftsoRewardManager: MockFtsoRewardManager;
  teller: Teller;
  treasury: Treasury;
  priceFeed: PriceFeed;
  auctioneer: Auctioneer;
  linearDecrease: LinearDecrease;
  liquidator: Liquidator;
  reservePool: ReservePool;
  mockErc20Token: MockERC20AssetManager;
  shutdown: Shutdown;
  mockVpToken: MockVPToken;
  vpAssetManager: VPAssetManager;
  lowApr: LowAPR;
  highApr: HighAPR;
  mockVaultEngine: MockVaultEngine;
  mockPriceFeed: MockPriceFeed;
  mockAuctioneer: MockAuctioneer;
  mockLiquidator: MockLiquidator;
  mockReserve: MockReservePool;
  mockPriceCalc: MockPriceCalc;
  mockBondIssuer: MockBondIssuer;
}

const artifactNameMap = {
  aurei: "Aurei",
  bondIssuer: "BondIssuer",
  phi: "Phi",
  ftso: "MockFtso",
  registry: "Registry",
  pbtToken: "PbtToken",
  vaultEngine: "VaultEngine",
  vaultEngineSB: "VaultEngineSB",
  vaultEngineCoston: "VaultEngineCoston",
  nativeAssetManager: "NativeAssetManager",
  erc20AssetManager: "ERC20AssetManager",
  ftsoManager: "MockFtsoManager",
  ftsoRewardManager: "MockFtsoRewardManager",
  teller: "Teller",
  treasury: "Treasury",
  priceFeed: "PriceFeed",
  auctioneer: "Auctioneer",
  linearDecrease: "LinearDecrease",
  liquidator: "Liquidator",
  reservePool: "ReservePool",
  mockErc20Token: "MockERC20AssetManager",
  mockVpToken: "MockVPToken",
  vpAssetManager: "VPAssetManager",
  shutdown: "Shutdown",
  lowApr: "LowAPR",
  highApr: "HighAPR",
  mockVaultEngine: "MockVaultEngine",
  mockPriceFeed: "MockPriceFeed",
  mockAuctioneer: "MockAuctioneer",
  mockLiquidator: "MockLiquidator",
  mockReserve: "MockReservePool",
  mockPriceCalc: "MockPriceCalc",
  mockBondIssuer: "MockBondIssuer",
};

const contracts: ContractDict = {
  aurei: null,
  bondIssuer: null,
  phi: null,
  ftso: null,
  registry: null,
  pbtToken: null,
  vaultEngine: null,
  vaultEngineSB: null,
  vaultEngineCoston: null,
  nativeAssetManager: null,
  erc20AssetManager: null,
  ftsoManager: null,
  ftsoRewardManager: null,
  teller: null,
  treasury: null,
  priceFeed: null,
  auctioneer: null,
  linearDecrease: null,
  liquidator: null,
  reservePool: null,
  mockErc20Token: null,
  vpAssetManager: null,
  mockVpToken: null,
  shutdown: null,
  lowApr: null,
  highApr: null,
  mockVaultEngine: null,
  mockPriceFeed: null,
  mockAuctioneer: null,
  mockLiquidator: null,
  mockReserve: null,
  mockPriceCalc: null,
  mockBondIssuer: null,
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

/**
 * @function parseExistingContracts
 * Uses the dotenv file to read addresses of existing contracts
 */
const parseExistingContracts = async () => {
  const signers = await getSigners();

  for (let [contractName, contract] of Object.entries(contracts)) {
    const contractDisplayName = contractName
      .split(/(?=[A-Z])/)
      .join("_")
      .toUpperCase();

    if (!!process.env[contractDisplayName]) {
      contracts[contractName] = new ethers.Contract(
        process.env[contractDisplayName],
        (await artifacts.readArtifact(artifactNameMap[contractName])).abi,
        signers.owner
      );
    }
  }

  // for each contracts if file read has an address for it, set it else move on
};

const deployRegistry = async (param?: { govAddress?: string }) => {
  if (contracts.registry !== null && process.env.NODE_ENV !== "test") {
    console.info("registry contract has already been deployed, skipping");
    return;
  }

  const signers = await getSigners();
  const govAddress =
    param && param.govAddress ? param.govAddress : signers.owner.address;
  const registryFactory = (await ethers.getContractFactory(
    "Registry",
    signers.owner
  )) as Registry__factory;
  contracts.registry = await registryFactory.deploy(govAddress);
  await contracts.registry.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("registry deployed ✓");
    console.info({
      address: contracts.registry.address,
      params: { govAddress },
    });
  }
  await checkDeploymentDelay();
  return contracts;
};

const deployAurei = async (param?: { registry?: string }) => {
  if (contracts.aurei !== null && process.env.NODE_ENV !== "test") {
    console.info("aurei contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as Aurei__factory;
  contracts.aurei = await aureiFactory.deploy(registry);
  await contracts.aurei.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("aurei deployed ✓");
    console.info({
      address: contracts.aurei.address,
      params: { registry },
    });
  }
  await contracts.registry.setupAddress(
    bytes32("aur"),
    contracts.aurei.address
  );
  await checkDeploymentDelay();
  return contracts;
};

const deployPhi = async (param?: { registry?: string }) => {
  if (contracts.phi !== null && process.env.NODE_ENV !== "test") {
    console.info("phi contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const phiFactory = (await ethers.getContractFactory(
    "Phi",
    signers.owner
  )) as Phi__factory;
  contracts.phi = await phiFactory.deploy(registry);
  await contracts.phi.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("phi deployed ✓");
    console.info({ registry });
  }
  await contracts.registry.setupAddress(bytes32("phi"), contracts.phi.address);
  await checkDeploymentDelay();
  return contracts;
};

const deployPbt = async (param?: { registry?: string }) => {
  if (contracts.pbtToken !== null && process.env.NODE_ENV !== "test") {
    console.info("pbt contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const pbtFactory = (await ethers.getContractFactory(
    "PbtToken",
    signers.owner
  )) as PbtToken__factory;
  contracts.pbtToken = await pbtFactory.deploy(registry);
  await contracts.pbtToken.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("pbt deployed ✓");
    console.info({ registry });
  }
  await contracts.registry.setupAddress(
    bytes32("pbt"),
    contracts.pbtToken.address
  );
  await checkDeploymentDelay();
  return contracts;
};

const deployApr = async () => {
  if (
    contracts.lowApr !== null &&
    contracts.highApr !== null &&
    process.env.NODE_ENV !== "test"
  ) {
    console.info("apr contract has already been deployed, skipping");
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployVaultEngine = async (param?: { registry?: string }) => {
  if (contracts.vaultEngine !== null && process.env.NODE_ENV !== "test") {
    console.info("vaultEngine contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngine",
    signers.owner
  )) as VaultEngine__factory;
  contracts.vaultEngine = await vaultEngineFactory.deploy(registry);
  await contracts.vaultEngine.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("vaultEngine deployed ✓");
    console.info({ registry });
  }
  await contracts.registry.setupAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngine.address
  );
  await checkDeploymentDelay();
  return contracts;
};

const deployVaultEngineCoston = async (param?: { registry?: string }) => {
  if (contracts.vaultEngineCoston !== null && process.env.NODE_ENV !== "test") {
    console.info("vaultEngine contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngineCoston",
    signers.owner
  )) as VaultEngineCoston__factory;
  contracts.vaultEngineCoston = await vaultEngineFactory.deploy(registry);
  await contracts.vaultEngineCoston.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("vaultEngineCoston deployed ✓");
    console.info({ registry });
  }
  await contracts.registry.setupAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngine.address
  );
  await checkDeploymentDelay();
  return contracts;
};

const deployVaultEngineSB = async (param?: { registry?: string }) => {
  if (contracts.vaultEngineSB !== null && process.env.NODE_ENV !== "test") {
    console.info("vaultEngineSB contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const signers = await getSigners();
  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngineSB",
    signers.owner
  )) as VaultEngineSB__factory;
  contracts.vaultEngineSB = await vaultEngineFactory.deploy(registry);
  await contracts.vaultEngineSB.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("vaultEngineSB deployed ✓");
    console.info({ registry });
  }
  await contracts.registry.setupAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngineSB.address
  );
  await checkDeploymentDelay();
  return contracts;
};

const deployVPAssetManager = async (param?: {
  registry?: string;
  assetId?: string;
  ftsoManager?: string;
  ftsoRewardManager?: string;
  mockVpToken?: string;
  vaultEngine?: string;
}) => {
  if (contracts.vpAssetManager !== null && process.env.NODE_ENV !== "test") {
    console.info("vpAssetManager contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const assetId =
    param && param.assetId
      ? param.assetId
      : web3.utils.keccak256("VPAssetManager");
  const ftsoManager =
    param && param.ftsoManager
      ? param.ftsoManager
      : contracts.ftsoManager.address;
  const ftsoRewardManager =
    param && param.ftsoRewardManager
      ? param.ftsoRewardManager
      : contracts.ftsoRewardManager.address;
  const mockVpToken =
    param && param.mockVpToken
      ? param.mockVpToken
      : contracts.mockVpToken.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const vpAssetManagerFactory = (await ethers.getContractFactory(
    "VPAssetManager",
    signers.owner
  )) as VPAssetManager__factory;
  contracts.vpAssetManager = await vpAssetManagerFactory.deploy(
    registry,
    assetId,
    ftsoManager,
    ftsoRewardManager,
    mockVpToken,
    vaultEngine
  );
  await contracts.vpAssetManager.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("vpAssetManager deployed ✓");
    console.info({
      registry: registry,
      assetId,
      ftsoManager,
      ftsoRewardManager,
      mockVpToken,
      vaultEngine,
    });
  }

  await contracts.registry.setupAddress(
    bytes32("assetManager"),
    contracts.vpAssetManager.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployERC20AssetManager = async (param?: {
  registry?: string;
  assetId?: string;
  mockErc20Token?: string;
  vaultEngine?: string;
}) => {
  if (contracts.erc20AssetManager !== null && process.env.NODE_ENV !== "test") {
    console.info("erc20CToken contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const assetId =
    param && param.assetId ? param.assetId : web3.utils.keccak256("FXRP");
  const mockErc20Token =
    param && param.mockErc20Token
      ? param.mockErc20Token
      : contracts.mockErc20Token.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const erc20AssetManagerFactory = (await ethers.getContractFactory(
    "ERC20AssetManager",
    signers.owner
  )) as ERC20AssetManager__factory;
  contracts.erc20AssetManager = await erc20AssetManagerFactory.deploy(
    registry,
    assetId,
    mockErc20Token,
    vaultEngine
  );
  await contracts.erc20AssetManager.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("erc20AssetManager deployed ✓");
    console.info({
      registry: registry,
      assetId,
      mockErc20Token,
      vaultEngine,
    });
  }

  await contracts.registry.setupAddress(
    bytes32("assetManager"),
    contracts.erc20AssetManager.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployNativeAssetManager = async (param?: {
  registry?: string;
  assetId?: string;
  vaultEngine?: string;
}) => {
  if (
    contracts.nativeAssetManager !== null &&
    process.env.NODE_ENV !== "test"
  ) {
    console.info(
      "nativeAssetManager contract has already been deployed, skipping"
    );
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const assetId =
    param && param.assetId
      ? param.assetId
      : web3.utils.keccak256(NETWORK_NATIVE_TOKEN);
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const nativeAssetManagerFactory = (await ethers.getContractFactory(
    "NativeAssetManager",
    signers.owner
  )) as NativeAssetManager__factory;
  contracts.nativeAssetManager = await nativeAssetManagerFactory.deploy(
    registry,
    assetId,
    vaultEngine
  );
  await contracts.nativeAssetManager.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("nativeAssetManager deployed ✓");
    console.info(`with native Token ${NETWORK_NATIVE_TOKEN}`);
    console.info({
      registry,
      assetId,
      vaultEngine,
    });
  }

  await contracts.registry.setupAddress(
    bytes32("assetManager"),
    contracts.nativeAssetManager.address
  );

  await checkDeploymentDelay();
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
  bondIssuer?: string;
}) => {
  if (contracts.shutdown !== null && process.env.NODE_ENV !== "test") {
    console.info("shutdown contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
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
  const bondIssuer =
    param && param.bondIssuer ? param.bondIssuer : contracts.bondIssuer.address;

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
    liquidator,
    bondIssuer
  );
  await contracts.shutdown.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("shutdown deployed ✓");
    console.info({
      registry,
      priceFeed,
      vaultEngine,
      reservePool,
      teller,
      treasury,
      liquidator,
      bondIssuer,
    });
  }

  await contracts.registry.setupAddress(
    bytes32("shutdown"),
    contracts.shutdown.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployTeller = async (param?: {
  registry?: string;
  vaultEngine?: string;
  lowApr?: string;
  highApr?: string;
  reservePool?: string;
}) => {
  if (contracts.teller !== null && process.env.NODE_ENV !== "test") {
    console.info("teller contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
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
  if (process.env.NODE_ENV !== "test") {
    console.info("teller deployed ✓");
    console.info({
      registry,
      vaultEngine,
      reservePool,
      lowApr,
      highApr,
    });
  }

  await contracts.registry.setupAddress(
    bytes32("teller"),
    contracts.teller.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployTreasury = async (param?: {
  registry?: string;
  stablecoin?: string;
  pbtToken?: string;
  vaultEngine?: string;
}) => {
  if (contracts.treasury !== null && process.env.NODE_ENV !== "test") {
    console.info("treasury contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const stablecoin =
    param && param.stablecoin ? param.stablecoin : contracts.aurei.address;
  const pbtToken =
    param && param.pbtToken ? param.pbtToken : contracts.pbtToken.address;
  const signers = await getSigners();

  const treasuryFactory = (await ethers.getContractFactory(
    "Treasury",
    signers.owner
  )) as Treasury__factory;
  contracts.treasury = await treasuryFactory.deploy(
    registry,
    stablecoin,
    pbtToken,
    vaultEngine
  );

  await contracts.treasury.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("treasury deployed ✓");
    console.info({
      registry,
      stablecoin,
      pbtToken,
      vaultEngine,
    });
  }

  await contracts.registry.setupAddress(
    bytes32("treasury"),
    contracts.treasury.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployPriceFeed = async (param?: {
  registry?: string;
  vaultEngine?: string;
}) => {
  if (contracts.priceFeed !== null && process.env.NODE_ENV !== "test") {
    console.info("priceFeed contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();

  const priceFeedFactory = (await ethers.getContractFactory(
    "PriceFeed",
    signers.owner
  )) as PriceFeed__factory;
  contracts.priceFeed = await priceFeedFactory.deploy(registry, vaultEngine);
  await contracts.priceFeed.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("priceFeed deployed ✓");
    console.info({ registry, vaultEngine });
  }

  await contracts.registry.setupAddress(
    bytes32("priceFeed"),
    contracts.priceFeed.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployAuctioneer = async (param?: {
  registry?: Registry;
  vaultEngine?: string;
  priceCalc?: string;
  priceFeed?: string;
  liquidator?: string;
}) => {
  if (contracts.auctioneer !== null && process.env.NODE_ENV !== "test") {
    console.info("auctioneer contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const linearDecrease =
    param && param.priceCalc
      ? param.priceCalc
      : contracts.linearDecrease.address;
  const priceFeed =
    param && param.priceFeed ? param.priceFeed : contracts.priceFeed.address;
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
    priceFeed,
    liquidator
  );

  await contracts.auctioneer.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("auctioneer deployed ✓");
    console.info({
      registry: registry.address,
      vaultEngine,
      linearDecrease,
      priceFeed,
      liquidator,
    });
  }

  await registry.setupAddress(
    bytes32("auctioneer"),
    contracts.auctioneer.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployPriceCalc = async () => {
  if (contracts.linearDecrease !== null && process.env.NODE_ENV !== "test") {
    console.info("linearDecrease contract has already been deployed, skipping");
    return contracts;
  }

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

  await checkDeploymentDelay();
  return contracts;
};

const deployBondIssuer = async (param?: {
  registry?: string;
  vaultEngine?: string;
}) => {
  if (contracts.bondIssuer !== null && process.env.NODE_ENV !== "test") {
    console.info("reservePool contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;

  const signers = await getSigners();
  const bondIssuerFactory = (await ethers.getContractFactory(
    "BondIssuer",
    signers.owner
  )) as BondIssuer__factory;
  contracts.bondIssuer = await bondIssuerFactory.deploy(registry, vaultEngine);
  await contracts.bondIssuer.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("bondIssuer deployed ✓");
    console.info({
      registry,
      vaultEngine,
    });
  }
  await contracts.registry.setupAddress(
    bytes32("bondIssuer"),
    contracts.bondIssuer.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployReservePool = async (param?: {
  registry?: string;
  vaultEngine?: string;
  bondIssuer?: string;
}) => {
  if (contracts.reservePool !== null && process.env.NODE_ENV !== "test") {
    console.info("reservePool contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const bondIssuer =
    param && param.bondIssuer ? param.bondIssuer : contracts.bondIssuer.address;

  const signers = await getSigners();
  const reservePoolFactory = (await ethers.getContractFactory(
    "ReservePool",
    signers.owner
  )) as ReservePool__factory;
  contracts.reservePool = await reservePoolFactory.deploy(
    registry,
    vaultEngine,
    bondIssuer
  );
  await contracts.reservePool.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("reservePool deployed ✓");
    console.info({
      registry,
      vaultEngine,
      bondIssuer,
    });
  }
  await contracts.registry.setupAddress(
    bytes32("reservePool"),
    contracts.reservePool.address
  );

  if (
    contracts.bondIssuer !== null &&
    (await contracts.bondIssuer.reservePoolAddress()) === ADDRESS_ZERO
  ) {
    await contracts.bondIssuer.setReservePoolAddress(
      contracts.reservePool.address
    );
  }

  await checkDeploymentDelay();
  return contracts;
};

const deployLiquidator = async (param?: {
  registry?: string;
  vaultEngine?: string;
  reservePool?: string;
  priceFeed?: string;
  treasury?: string;
}) => {
  if (contracts.liquidator !== null && process.env.NODE_ENV !== "test") {
    console.info("liquidator contract has already been deployed, skipping");
    return contracts;
  }

  const registry =
    param && param.registry ? param.registry : contracts.registry.address;
  const vaultEngine =
    param && param.vaultEngine
      ? param.vaultEngine
      : process.env.STABLECOIN?.toUpperCase() === "PHI"
      ? contracts.vaultEngineSB.address
      : contracts.vaultEngine.address;
  const reservePool =
    param && param.reservePool
      ? param.reservePool
      : contracts.reservePool.address;
  const priceFeed =
    param && param.priceFeed ? param.priceFeed : contracts.priceFeed.address;
  const treasury =
    param && param.treasury ? param.treasury : contracts.treasury.address;

  const signers = await getSigners();
  const liquidatorFactory = (await ethers.getContractFactory(
    "Liquidator",
    signers.owner
  )) as Liquidator__factory;
  contracts.liquidator = await liquidatorFactory.deploy(
    registry,
    vaultEngine,
    reservePool,
    priceFeed,
    treasury
  );
  await contracts.liquidator.deployed();
  if (process.env.NODE_ENV !== "test") {
    console.info("liquidator deployed ✓");
    console.info({
      registry,
      vaultEngine,
      reservePool,
    });
  }
  await contracts.registry.setupAddress(
    bytes32("liquidator"),
    contracts.liquidator.address
  );

  await checkDeploymentDelay();
  return contracts;
};

const deployMockErc20Token = async () => {
  if (contracts.erc20AssetManager !== null && process.env.NODE_ENV !== "test") {
    console.info("mockErc20Token contract has already been deployed, skipping");
    return contracts;
  }

  const signers = await getSigners();
  const mockErc20TokenFactory = (await ethers.getContractFactory(
    "MockERC20AssetManager",
    signers.owner
  )) as MockERC20AssetManager__factory;
  contracts.mockErc20Token = await mockErc20TokenFactory.deploy();
  await contracts.mockErc20Token.deployed();
  return contracts;
};

const deployMockVPToken = async () => {
  if (contracts.mockVpToken !== null && process.env.NODE_ENV !== "test") {
    console.info("mockVpToken contract has already been deployed, skipping");
    return;
  }

  const signers = await getSigners();
  const mockVpTokenFactory = (await ethers.getContractFactory(
    "MockVPToken",
    signers.owner
  )) as MockVPToken__factory;
  contracts.mockVpToken = await mockVpTokenFactory.deploy();
  await contracts.mockVpToken.deployed();
  if (process.env.NODE_ENV !== "test") console.info("mockVpToken deployed ✓");
  await checkDeploymentDelay();
  return contracts;
};

const deployMockVaultEngine = async () => {
  if (contracts.mockVaultEngine !== null && process.env.NODE_ENV !== "test") {
    console.info(
      "mockVaultEngine contract has already been deployed, skipping"
    );
    return contracts;
  }

  const signers = await getSigners();
  const mockVaultEngineFactory = (await ethers.getContractFactory(
    "MockVaultEngine",
    signers.owner
  )) as MockVaultEngine__factory;
  contracts.mockVaultEngine = await mockVaultEngineFactory.deploy();
  await contracts.mockVaultEngine.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("mockVaultEngine deployed ✓");
  await checkDeploymentDelay();
  return contracts;
};

const deployMockPriceCalc = async () => {
  if (contracts.mockPriceCalc !== null && process.env.NODE_ENV !== "test") {
    console.info("mockPriceCalc contract has already been deployed, skipping");
    return contracts;
  }

  const signers = await getSigners();
  const mockPriceCalcFactory = (await ethers.getContractFactory(
    "MockPriceCalc",
    signers.owner
  )) as MockPriceCalc__factory;
  contracts.mockPriceCalc = await mockPriceCalcFactory.deploy();
  await contracts.mockPriceCalc.deployed();
  if (process.env.NODE_ENV !== "test") console.info("mockPriceCalc deployed ✓");
  await checkDeploymentDelay();
  return contracts;
};

const deployMockFtso = async () => {
  if (contracts.ftso !== null && process.env.NODE_ENV !== "test") {
    console.info("Mock ftso contract has already been deployed, skipping");
    return;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockFtsoManager = async () => {
  if (contracts.ftsoManager !== null && process.env.NODE_ENV !== "test") {
    console.info(
      "Mock ftsoManager contract has already been deployed, skipping"
    );
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockFtsoRewardManager = async () => {
  if (contracts.ftsoRewardManager !== null && process.env.NODE_ENV !== "test") {
    console.info(
      "Mock ftsoRewardManager contract has already been deployed, skipping"
    );
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockPriceFeed = async () => {
  if (contracts.mockPriceFeed !== null && process.env.NODE_ENV !== "test") {
    console.info("Mock PriceFeed contract has already been deployed, skipping");
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockLiquidator = async () => {
  if (contracts.mockLiquidator !== null && process.env.NODE_ENV !== "test") {
    console.info("mockLiquidator contract has already been deployed, skipping");
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockAuctioneer = async () => {
  if (contracts.mockAuctioneer !== null && process.env.NODE_ENV !== "test") {
    console.info("mockAuctioneer contract has already been deployed, skipping");
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockReservePool = async () => {
  if (contracts.mockReserve !== null && process.env.NODE_ENV !== "test") {
    console.info("mockReserve contract has already been deployed, skipping");
    return contracts;
  }

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
  await checkDeploymentDelay();
  return contracts;
};

const deployMockBondIssuer = async () => {
  if (contracts.mockBondIssuer !== null && process.env.NODE_ENV !== "test") {
    console.info("mockReserve contract has already been deployed, skipping");
    return contracts;
  }

  // Set signers
  const signers = await getSigners();

  const mockBondIssuer = (await ethers.getContractFactory(
    "MockBondIssuer",
    signers.owner
  )) as MockBondIssuer__factory;
  contracts.mockBondIssuer = await mockBondIssuer.deploy();
  await contracts.mockBondIssuer.deployed();
  if (process.env.NODE_ENV !== "test")
    console.info("mockBondIssuer deployed ✓");

  await contracts.registry.setupAddress(
    bytes32("bondIssuer"),
    contracts.mockBondIssuer.address
  );
  await checkDeploymentDelay();
  return contracts;
};

const deployMocks = async () => {
  const signers = await getSigners();
  await deployMockErc20Token();
  await deployMockVPToken();
  await deployMockFtso();
  await deployMockFtsoManager();
  await deployMockFtsoRewardManager();
  await deployMockPriceFeed();
  await deployMockReservePool();
  await deployMockAuctioneer();
  await deployMockLiquidator();
  await deployMockBondIssuer();

  return { contracts, signers };
};

const deployProbity = async (stablecoin?: string) => {
  const signers = await getSigners();
  if (stablecoin && !["AUR", "PHI"].includes(stablecoin))
    throw Error('Token must be either "AUR" or "PHI".');
  stablecoin = stablecoin === undefined ? "AUR" : stablecoin;
  let contracts =
    stablecoin === "AUR" ? await deployAurei() : await deployPhi();
  await deployPbt();
  await deployApr();
  contracts =
    stablecoin === "AUR"
      ? await deployVaultEngine()
      : await deployVaultEngineSB();
  await deployNativeAssetManager();
  await deployBondIssuer();
  await deployReservePool();
  await deployTeller();
  await deployPriceCalc();
  await deployPriceFeed();
  await deployTreasury({
    stablecoin:
      stablecoin.toUpperCase() === "PHI"
        ? contracts.phi.address
        : contracts.aurei.address,
  });
  await deployLiquidator();
  await deployShutdown();

  return { contracts, signers };
};

////
// Deployments by environment
////
function checkDeploymentDelay() {
  if (process.env.DEPLOYMENT_DELAY === undefined) return;
  const delayTime = parseInt(process.env.DEPLOYMENT_DELAY);
  console.log(`sleeping for ${delayTime} ms`);
  return new Promise((resolve) => setTimeout(resolve, delayTime));
}

const deployDev = async (stablecoin?: string) => {
  await parseExistingContracts();
  const signers = await getSigners();
  try {
    await deployRegistry();
    await deployMocks();
    await deployProbity(stablecoin);
    await deployAuctioneer();
    await deployERC20AssetManager();
    await deployVPAssetManager();
  } catch (err) {
    console.error("Error occurred while deploying", err);
    return { contracts, signers };
  }

  return { contracts, signers };
};

const deployTest = async (stablecoin?: string) => {
  const signers = await getSigners();
  await deployRegistry();
  await deployMocks();
  await deployProbity(stablecoin);
  await deployVaultEngineSB();
  await deployVaultEngineCoston();
  await deployAuctioneer();
  await deployERC20AssetManager();
  await deployVPAssetManager();
  await deployMockVaultEngine();
  await deployMockPriceCalc();
  return { contracts, signers };
};

const deployProd = async (stablecoin?: string) => {
  await parseExistingContracts();
  const signers = await getSigners();
  try {
    await deployRegistry();
    await deployMocks(); // for coston only
    await deployProbity(stablecoin);
    await deployAuctioneer();
    await deployERC20AssetManager();
    await deployVPAssetManager();
  } catch (err) {
    console.error("Error occurred while deploying", err);
    return { contracts, signers };
  }
  return { contracts, signers };
};

const probity = {
  deployRegistry,
  deployAurei,
  deployPbt,
  deployApr,
  deployVaultEngine,
  deployNativeAssetManager,
  deployERC20AssetManager,
  deployVPAssetManager,
  deployTeller,
  deployPriceCalc,
  deployPriceFeed,
  deployAuctioneer,
  deployTreasury,
  deployReservePool,
  deployLiquidator,
  deployShutdown,
  deployBondIssuer,
};

const mock = {
  deployMockErc20Token,
  deployMockVPToken,
  deployMockFtso,
  deployMockFtsoManager,
  deployMockFtsoRewardManager,
  deployMockVaultEngine,
  deployMockPriceFeed,
  deployMockBondIssuer,
};

export {
  deployDev,
  deployProd,
  deployTest,
  probity,
  mock,
  parseExistingContracts,
};
