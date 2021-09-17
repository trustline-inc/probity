import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { ethers, web3 } from "hardhat";

// Import contract factory types
import {
  AureiFactory,
  TcnTokenFactory,
  BridgeFactory,
  FtsoFactory,
  RegistryFactory,
  VaultFactory,
  StateConnectorFactory,
  NativeCollateralFactory,
  Erc20CollateralFactory,
  TellerFactory,
  TreasuryFactory,
  PriceFeedFactory,
  AuctioneerFactory,
  LinearDecreaseFactory,
  LiquidatorFactory,
  ReservePoolFactory,
  Erc20TokenFactory,
  LowAprFactory,
  HighAprFactory,
} from "../typechain";

// Import contract types
import {
  Aurei,
  BridgeOld,
  Ftso,
  Registry,
  TcnToken,
  StateConnector,
  NativeCollateral,
  Erc20Collateral,
  Teller,
  Treasury,
  PriceFeed,
  Auctioneer,
  LinearDecrease,
  Liquidator,
  ReservePool,
  Erc20Token,
  Vault,
  LowApr,
  HighApr,
} from "../typechain";

/**
 * Contracts
 */
interface Contracts {
  aurei: Aurei;
  bridge: BridgeOld;
  ftso: Ftso;
  registry: Registry;
  tcnToken: TcnToken;
  vault: Vault;
  stateConnector: StateConnector;
  flrCollateral: NativeCollateral;
  fxrpCollateral: Erc20Collateral;
  teller: Teller;
  treasury: Treasury;
  priceFeed: PriceFeed;
  auctioneer: Auctioneer;
  linearDecrease: LinearDecrease;
  liquidator: Liquidator;
  reserve: ReservePool;
  erc20: Erc20Token;
  lowApr: LowApr;
  highApr: HighApr;
}

const contracts: Contracts = {
  aurei: null,
  bridge: null,
  ftso: null,
  registry: null,
  tcnToken: null,
  vault: null,
  stateConnector: null,
  flrCollateral: null,
  fxrpCollateral: null,
  teller: null,
  treasury: null,
  priceFeed: null,
  auctioneer: null,
  linearDecrease: null,
  liquidator: null,
  reserve: null,
  erc20: null,
  lowApr: null,
  highApr: null,
};

// Contracts submitted to the register
enum Contract {
  Aurei,
  Bridge,
  Ftso,
  TcnToken,
  Teller,
  Treasury,
  Vault,
  LOW_APR,
  HIGH_APR,
}

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
  contracts.aurei = await aureiFactory.deploy();
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
  contracts.tcnToken = await tcnFactory.deploy();
  await contracts.tcnToken.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("tcn"),
    contracts.tcnToken.address
  );

  return contracts;
};

const deployVault = async () => {
  // Set signers
  const signers = await getSigners();

  const vaultFactory = (await ethers.getContractFactory(
    "Vault",
    signers.owner
  )) as VaultFactory;
  contracts.vault = await vaultFactory.deploy(contracts.registry.address);
  await contracts.vault.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("vault"),
    contracts.vault.address
  );

  return contracts;
};

const deployCollateral = async () => {
  // Set signers
  const signers = await getSigners();

  const flrCollateralFactory = (await ethers.getContractFactory(
    "NativeCollateral",
    signers.owner
  )) as NativeCollateralFactory;
  contracts.flrCollateral = await flrCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256("FLR Collateral"),
    contracts.vault.address
  );
  await contracts.flrCollateral.deployed();

  const fxrpCollateralFactory = (await ethers.getContractFactory(
    "ERC20Collateral",
    signers.owner
  )) as Erc20CollateralFactory;
  contracts.fxrpCollateral = await fxrpCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256("FXRP Collateral"),
    contracts.erc20.address,
    contracts.vault.address
  );
  await contracts.fxrpCollateral.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.flrCollateral.address
  );
  await contracts.registry.setupContractAddress(
    bytes32("collateral"),
    contracts.fxrpCollateral.address
  );

  return contracts;
};

const deployFtso = async () => {
  // Set signers
  const signers = await getSigners();

  const ftsoFactory = (await ethers.getContractFactory(
    "Ftso",
    signers.owner
  )) as FtsoFactory;
  contracts.ftso = await ftsoFactory.deploy();
  await contracts.ftso.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("ftso"),
    contracts.ftso.address
  );

  return contracts;
};

const deployTeller = async () => {
  // Set signers
  const signers = await getSigners();

  const vaultFactory = (await ethers.getContractFactory(
    "Vault",
    signers.owner
  )) as VaultFactory;
  contracts.vault = await vaultFactory.deploy(contracts.registry.address, {
    gasLimit: 8000000,
  });
  await contracts.vault.deployed();

  const tellerFactory = (await ethers.getContractFactory(
    "Teller",
    signers.owner
  )) as TellerFactory;
  contracts.teller = await tellerFactory.deploy(
    contracts.registry.address,
    contracts.vault.address
  );
  await contracts.teller.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("teller"),
    contracts.teller.address
  );

  return contracts;
};

const deployTreasury = async () => {
  // Set signers
  const signers = await getSigners();

  const treasuryFactory = (await ethers.getContractFactory(
    "Treasury",
    signers.owner
  )) as TreasuryFactory;
  contracts.treasury = await treasuryFactory.deploy(
    contracts.registry.address,
    contracts.aurei.address,
    contracts.tcnToken.address,
    contracts.vault.address
  );
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
    contracts.vault.address
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
    contracts.vault.address,
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
  await contracts.registry.setupContractAddress(
    Contract.LOW_APR,
    contracts.lowApr.address
  );
  await contracts.registry.setupContractAddress(
    Contract.HIGH_APR,
    contracts.highApr.address
  );

  return contracts;
};

const deployBridge = async () => {
  const signers = await getSigners();

  const stateConnectorFactory = (await ethers.getContractFactory(
    "StateConnector",
    signers.owner
  )) as StateConnectorFactory;
  contracts.stateConnector = await stateConnectorFactory.deploy();
  await contracts.stateConnector.deployed();

  const bridgeFactory = (await ethers.getContractFactory(
    "BridgeOld",
    signers.owner
  )) as BridgeOldFactory;
  contracts.bridge = await bridgeFactory.deploy(
    contracts.aurei.address,
    contracts.stateConnector.address
  );
  await contracts.bridge.deployed();

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
    contracts.vault.address
  );

  await contracts.reserve.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("reserve"),
    contracts.reserve.address
  );

  return contracts;
};

const deployERC20 = async () => {
  const signers = await getSigners();

  const erc20Factory = (await ethers.getContractFactory(
    "ERC20Token",
    signers.owner
  )) as Erc20TokenFactory;
  contracts.erc20 = await erc20Factory.deploy();

  await contracts.erc20.deployed();

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
    contracts.vault.address,
    contracts.reserve.address
  );

  await contracts.liquidator.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("liquidator"),
    contracts.liquidator.address
  );

  return contracts;
};

const deployLowApr = async () => {
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

  return contracts;
};

const deployHighApr = async () => {
  const signers = await getSigners();
  const aprFactory = (await ethers.getContractFactory(
    "HighAPR",
    signers.owner
  )) as HighAprFactory;
  contracts.highApr = await aprFactory.deploy();
  await contracts.highApr.deployed();

  await contracts.registry.setupContractAddress(
    bytes32("highApr"),
    contracts.highApr.address
  );

  return contracts;
};

const deployProbity = async () => {
  // Set signers
  const signers = await getSigners();
  await deployRegistry();
  await deployAUR();
  await deployTCN();
  await deployVault();
  await deployERC20();
  await deployCollateral();
  await deployFtso();
  await deployTeller();
  await deployPriceCalc();
  await deployPriceFeed();
  await deployAuction();
  await deployTreasury();
  await deployReserve();
  await deployLiquidator();
  await deployLowApr();
  await deployHighApr();

  return { contracts, signers };
};

const deployBridgeSystem = async () => {
  // Set signers
  const signers = await getSigners();
  await deployRegistry();
  await deployAUR();
  await deployBridge();

  return { contracts, signers };
};

const deployAll = async () => {
  const signers = await getSigners();
  await deployProbity();
  await deployBridgeSystem();

  return { contracts, signers };
};

export { deployAll, deployProbity, deployBridgeSystem };
