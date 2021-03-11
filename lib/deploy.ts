import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";

// Import contract factory types
import {
  AureiFactory,
  CustodianFactory,
  ProbityFactory,
  RegistryFactory,
  TellerFactory,
  TreasuryFactory,
  ExchangeFactory,
} from "../typechain";

// Import contract types
import {
  Aurei,
  Custodian,
  Probity,
  Registry,
  Teller,
  Treasury,
  Exchange,
} from "../typechain";

// See https://github.com/nomiclabs/hardhat/issues/1001
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

/**
 * Contracts
 */
interface Contracts {
  aurei: Aurei;
  exchange: Exchange;
  custodian: Custodian;
  probity: Probity;
  registry: Registry;
  teller: Teller;
  treasury: Treasury;
}

const contracts: Contracts = {
  aurei: null,
  exchange: null,
  custodian: null,
  probity: null,
  registry: null,
  teller: null,
  treasury: null,
};

enum Contract {
  Aurei,
  Custodian,
  Exchange,
  Probity,
  Teller,
  Treasury,
}

interface Signers {
  owner: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  charlie: SignerWithAddress;
  don: SignerWithAddress;
  lender: SignerWithAddress;
  borrower: SignerWithAddress;
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

  const custodianFactory = (await ethers.getContractFactory(
    "Custodian",
    signers.owner
  )) as CustodianFactory;
  contracts.custodian = await custodianFactory.deploy(
    contracts.registry.address
  );
  await contracts.custodian.deployed();

  const exchangeFactory = (await ethers.getContractFactory(
    "Exchange",
    signers.owner
  )) as ExchangeFactory;
  contracts.exchange = await exchangeFactory.deploy(contracts.registry.address);
  await contracts.exchange.deployed();

  const probityFactory = (await ethers.getContractFactory(
    "Probity",
    signers.owner
  )) as ProbityFactory;
  contracts.probity = await probityFactory.deploy(contracts.registry.address);
  await contracts.probity.deployed();

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

  await contracts.registry.setupContractAddress(
    Contract.Aurei,
    contracts.aurei.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Custodian,
    contracts.custodian.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Exchange,
    contracts.exchange.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Probity,
    contracts.probity.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Teller,
    contracts.teller.address
  );
  await contracts.registry.setupContractAddress(
    Contract.Treasury,
    contracts.treasury.address
  );

  await contracts.custodian.initializeContract();
  await contracts.exchange.initializeContract();
  await contracts.probity.initializeContract();
  await contracts.teller.initializeContract();
  await contracts.treasury.initializeContract();

  return { contracts, signers };
};

export default deploy;
