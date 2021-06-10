import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";

// Import contract factory types
import {
  AureiFactory,
  BridgeFactory,
  ComptrollerFactory,
  FtsoFactory,
  MarketFactoryFactory,
  RegistryFactory,
  TcnTokenFactory,
  TellerFactory,
  TreasuryFactory,
  VaultFactory,
} from "../typechain";

// Import contract types
import {
  Aurei,
  Bridge,
  Comptroller,
  Ftso,
  MarketFactory,
  Registry,
  TcnToken,
  Teller,
  Treasury,
  Vault,
} from "../typechain";

const STATE_CONNECTOR_ADDRESS = "0x1000000000000000000000000000000000000001";

/**
 * Contracts
 */
interface Contracts {
  aurei: Aurei;
  bridge: Bridge;
  comptroller: Comptroller;
  ftso: Ftso;
  marketFactory: MarketFactory;
  registry: Registry;
  tcnToken: TcnToken;
  teller: Teller;
  treasury: Treasury;
  vault: Vault;
}

const contracts: Contracts = {
  aurei: null,
  bridge: null,
  comptroller: null,
  ftso: null,
  marketFactory: null,
  registry: null,
  tcnToken: null,
  teller: null,
  treasury: null,
  vault: null,
};

// Contracts submitted to the register
enum Contract {
  Aurei,
  Bridge,
  Comptroller,
  Ftso,
  MarketFactory,
  TcnToken,
  Teller,
  Treasury,
  Vault,
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

/**
 * @function deploy
 */
const deploy = async () => {
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

  // Deploy contracts

  const registryFactory = (await ethers.getContractFactory(
    "Registry",
    signers.owner
  )) as RegistryFactory;
  contracts.registry = await registryFactory.deploy();
  await contracts.registry.deployed();

  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as AureiFactory;
  contracts.aurei = await aureiFactory.deploy();
  await contracts.aurei.deployed();

  const comptrollerFactory = (await ethers.getContractFactory(
    "Comptroller",
    signers.owner
  )) as ComptrollerFactory;
  contracts.comptroller = await comptrollerFactory.deploy(
    contracts.registry.address
  );
  await contracts.comptroller.deployed();

  const marketFactoryFactory = (await ethers.getContractFactory(
    "MarketFactory",
    signers.owner
  )) as MarketFactoryFactory;
  contracts.marketFactory = await marketFactoryFactory.deploy(
    contracts.registry.address
  );
  await contracts.marketFactory.deployed();

  const ftsoFactory = (await ethers.getContractFactory(
    "Ftso",
    signers.owner
  )) as FtsoFactory;
  const initialPrice = "189370"; // XAU/USD = $1,893.70
  contracts.ftso = await ftsoFactory.deploy(initialPrice.toString());
  await contracts.ftso.deployed();

  const vaultFactory = (await ethers.getContractFactory(
    "Vault",
    signers.owner
  )) as VaultFactory;
  contracts.vault = await vaultFactory.deploy(contracts.registry.address);
  await contracts.vault.deployed();

  const tcnTokenFactory = (await ethers.getContractFactory(
    "TcnToken",
    signers.owner
  )) as TcnTokenFactory;
  contracts.tcnToken = await tcnTokenFactory.deploy();
  await contracts.tcnToken.deployed();

  const tellerFactory = (await ethers.getContractFactory(
    "Teller",
    signers.owner
  )) as TellerFactory;
  contracts.teller = await tellerFactory.deploy(contracts.registry.address);
  await contracts.teller.deployed();

  const treasuryFactory = (await ethers.getContractFactory(
    "Treasury",
    signers.owner
  )) as TreasuryFactory;
  contracts.treasury = await treasuryFactory.deploy(contracts.registry.address);
  await contracts.treasury.deployed();

  /**
   * Register contract addresses
   */
  await contracts.registry.setupContractAddress(
    Contract.Aurei,
    contracts.aurei.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Comptroller,
    contracts.comptroller.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Ftso,
    contracts.ftso.address
  );
  await contracts.registry.setupContractAddress(
    Contract.MarketFactory,
    contracts.marketFactory.address
  );
  await contracts.registry.setupContractAddress(
    Contract.TcnToken,
    contracts.tcnToken.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Teller,
    contracts.teller.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Treasury,
    contracts.treasury.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Vault,
    contracts.vault.address
  );

  const bridgeFactory = (await ethers.getContractFactory(
    "Bridge",
    signers.owner
  )) as BridgeFactory;
  contracts.bridge = await bridgeFactory.deploy(
    contracts.aurei.address,
    STATE_CONNECTOR_ADDRESS
  );
  await contracts.bridge.deployed();
  await contracts.registry.setupContractAddress(
    Contract.Bridge,
    contracts.bridge.address
  );

  await contracts.comptroller.initializeContract();
  await contracts.teller.initializeContract();
  await contracts.treasury.initializeContract();
  await contracts.vault.initializeContract();

  return { contracts, signers };
};

export default deploy;
