import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";

// Import contract factory types
import {
  AureiFactory,
  BridgeFactory,
  FtsoFactory,
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
  Ftso,
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
  ftso: Ftso;
  registry: Registry;
  tcnToken: TcnToken;
  teller: Teller;
  treasury: Treasury;
  vault: Vault;
}

const contracts: Contracts = {
  aurei: null,
  bridge: null,
  ftso: null,
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
  Ftso,
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
  bootstrapper: SignerWithAddress;
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
  bootstrapper: null,
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
    signers.bootstrapper,
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

  const ftsoFactory = (await ethers.getContractFactory(
    "Ftso",
    signers.owner
  )) as FtsoFactory;
  const initialPrice = "121"; // $1.21
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
    Contract.Ftso,
    contracts.ftso.address
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

  await contracts.teller.initializeContract();
  await contracts.treasury.initializeContract();
  await contracts.vault.initializeContract();

  return { contracts, signers };
};

export default deploy;
