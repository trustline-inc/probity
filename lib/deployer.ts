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

const deployRegistry = async () => {
  const signers = await getSigners();

  const registryFactory = (await ethers.getContractFactory(
    "Registry",
    signers.owner
  )) as RegistryFactory;
  contracts.registry = await registryFactory.deploy(signers.owner.address);
  await contracts.registry.deployed();

  return contracts;
};

const deployAUR = async () => {
  // Set signers
  const signers = await getSigners();

  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as AureiFactory;
  contracts.aurei = await aureiFactory.deploy(contracts.registry.address);
  await contracts.aurei.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("aur"),
    contracts.aurei.address
  );

  return contracts;
};

const deployTCN = async () => {
  // Set signers
  const signers = await getSigners();

  const tcnFactory = (await ethers.getContractFactory(
    "TcnToken",
    signers.owner
  )) as TcnTokenFactory;
  contracts.tcnToken = await tcnFactory.deploy(contracts.registry.address);
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

const deployVaultEngine = async () => {
  // Set signers
  const signers = await getSigners();

  const vaultEngineFactory = (await ethers.getContractFactory(
    "VaultEngine",
    signers.owner
  )) as VaultEngineFactory;
  contracts.vaultEngine = await vaultEngineFactory.deploy(
    contracts.registry.address
  );
  await contracts.vaultEngine.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("vaultEngine"),
    contracts.vaultEngine.address
  );

  return contracts;
};

const deployVPTokenCollateral = async () => {
  const signers = await getSigners();

  const vpTokenCollateralFactory = (await ethers.getContractFactory(
    "VPTokenCollateral",
    signers.owner
  )) as VpTokenCollateralFactory;
  contracts.vpTokenCollateral = await vpTokenCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256("VPToken"),
    contracts.ftsoManager.address,
    contracts.ftsoRewardManager.address,
    contracts.vpToken.address,
    contracts.vaultEngine.address
  );
  await contracts.vpTokenCollateral.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.vpTokenCollateral.address
  );
};

const deployCollateral = async () => {
  // Set signers
  const signers = await getSigners();

  const nativeCollateralFactory = (await ethers.getContractFactory(
    "NativeCollateral",
    signers.owner
  )) as NativeCollateralFactory;
  contracts.nativeCollateral = await nativeCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256(NETWORK_NATIVE_TOKEN),
    contracts.vaultEngine.address
  );
  await contracts.nativeCollateral.deployed();

  const fxrpCollateralFactory = (await ethers.getContractFactory(
    "ERC20Collateral",
    signers.owner
  )) as Erc20CollateralFactory;
  contracts.fxrpCollateral = await fxrpCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256("FXRP"),
    contracts.erc20.address,
    contracts.vaultEngine.address
  );
  await contracts.fxrpCollateral.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.nativeCollateral.address
  );
  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.fxrpCollateral.address
  );

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

const deployTeller = async () => {
  // Set signers
  const signers = await getSigners();

  const tellerFactory = (await ethers.getContractFactory(
    "Teller",
    signers.owner
  )) as TellerFactory;
  contracts.teller = await tellerFactory.deploy(
    contracts.registry.address,
    contracts.vaultEngine.address,
    contracts.lowApr.address,
    contracts.highApr.address
  );
  await contracts.teller.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("teller"),
    contracts.teller.address
  );

  return contracts;
};

const deployTreasury = async (param?) => {
  // Set signers
  const signers = await getSigners();

  const treasuryFactory = (await ethers.getContractFactory(
    "Treasury",
    signers.owner
  )) as TreasuryFactory;
  if (param === undefined) {
    contracts.treasury = await treasuryFactory.deploy(
      contracts.registry.address,
      contracts.aurei.address,
      contracts.tcnToken.address,
      contracts.vaultEngine.address
    );
  } else {
    contracts.treasury = await treasuryFactory.deploy(
      param.registry.address,
      param.aurei.address,
      param.tcnToken.address,
      param.vaultEngine.address
    );
  }

  await contracts.treasury.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("treasury"),
    contracts.treasury.address
  );

  return contracts;
};

const deployPriceFeed = async () => {
  // Set signers
  const signers = await getSigners();

  const priceFeedFactory = (await ethers.getContractFactory(
    "PriceFeed",
    signers.owner
  )) as PriceFeedFactory;
  contracts.priceFeed = await priceFeedFactory.deploy(
    contracts.registry.address,
    contracts.vaultEngine.address
  );
  await contracts.priceFeed.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("priceFeed"),
    contracts.priceFeed.address
  );

  return contracts;
};

const deployAuction = async () => {
  // Set signers
  const signers = await getSigners();

  const auctionFactory = (await ethers.getContractFactory(
    "Auctioneer",
    signers.owner
  )) as AuctioneerFactory;
  contracts.auctioneer = await auctionFactory.deploy(
    contracts.registry.address,
    contracts.vaultEngine.address,
    contracts.linearDecrease.address,
    contracts.ftso.address
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

const deployReserve = async () => {
  const signers = await getSigners();

  const reserveFactory = (await ethers.getContractFactory(
    "ReservePool",
    signers.owner
  )) as ReservePoolFactory;
  contracts.reserve = await reserveFactory.deploy(
    contracts.registry.address,
    contracts.vaultEngine.address
  );

  await contracts.reserve.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("reserve"),
    contracts.reserve.address
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

const deployLiquidator = async () => {
  const signers = await getSigners();

  const liquidatorFactory = (await ethers.getContractFactory(
    "Liquidator",
    signers.owner
  )) as LiquidatorFactory;
  contracts.liquidator = await liquidatorFactory.deploy(
    contracts.registry.address,
    contracts.vaultEngine.address,
    contracts.reserve.address
  );

  await contracts.liquidator.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("liquidator"),
    contracts.liquidator.address
  );

  return contracts;
};

const deployProbity = async () => {
  // Set signers
  const signers = await getSigners();
  await deployRegistry();
  await deployAUR();
  await deployTCN();
  await deployApr();
  await deployVaultEngine();
  await deployMockERC20();
  await deployMockVPToken();
  await deployMockFtso();
  await deployMockFtsoManager();
  await deployMockFtsoRewardManager();
  await deployMockVaultEngine();
  await deployCollateral();
  await deployVPTokenCollateral();
  await deployTeller();
  await deployPriceCalc();
  await deployPriceFeed();
  await deployAuction();
  await deployTreasury();
  await deployReserve();
  await deployLiquidator();

  return { contracts, signers };
};

const deployAll = async () => {
  const signers = await getSigners();
  await deployProbity();

  return { contracts, signers };
};

const probity = {
  deployRegistry,
  deployAUR,
  deployTCN,
  deployApr,
  deployVaultEngine,
  deployCollateral,
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

export { deployAll, deployProbity, probity, mock };
