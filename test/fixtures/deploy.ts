import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-waffle";
import { ethers, web3 } from "hardhat";

// Import contract factory types
import {
  AureiFactory,
  BridgeFactory,
  RegistryFactory,
  VaultFactory,
  StateConnectorFactory,
  FlrCollateralFactory,
  Erc20CollateralFactory,
} from "../../typechain";

// Import contract types
import {
  Aurei,
  Bridge,
  Ftso,
  Registry,
  TcnToken,
  Vault,
  StateConnector,
  FlrCollateral,
  Erc20Collateral,
} from "../../typechain";

/**
 * Contracts
 */
interface Contracts {
  aurei: Aurei;
  bridge: Bridge;
  ftso: Ftso;
  registry: Registry;
  tcnToken: TcnToken;
  vault: Vault;
  stateConnector: StateConnector;
  flrCollateral: FlrCollateral;
  fxrpCollateral: Erc20Collateral;
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

const deployBridge = async () => {
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

  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as AureiFactory;
  contracts.aurei = await aureiFactory.deploy();
  await contracts.aurei.deployed();

  const stateConnectorFactory = (await ethers.getContractFactory(
    "StateConnector",
    signers.owner
  )) as StateConnectorFactory;
  contracts.stateConnector = await stateConnectorFactory.deploy();
  await contracts.stateConnector.deployed();

  const bridgeFactory = (await ethers.getContractFactory(
    "Bridge",
    signers.owner
  )) as BridgeFactory;
  contracts.bridge = await bridgeFactory.deploy(
    contracts.aurei.address,
    contracts.stateConnector.address
  );
  await contracts.bridge.deployed();

  return { contracts, signers };
};

const deployCollateral = async () => {
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

  const registryFactory = (await ethers.getContractFactory(
    "Registry",
    signers.owner
  )) as RegistryFactory;
  contracts.registry = await registryFactory.deploy();
  await contracts.registry.deployed();

  const vaultFactory = (await ethers.getContractFactory(
    "Vault",
    signers.owner
  )) as VaultFactory;
  contracts.vault = await vaultFactory.deploy(contracts.registry.address);
  await contracts.vault.deployed();

  await contracts.registry.setupContractAddress(
    Contract.Vault,
    contracts.vault.address
  );

  const flrCollateralFactory = (await ethers.getContractFactory(
    "FLRCollateral",
    signers.owner
  )) as FlrCollateralFactory;
  contracts.flrCollateral = await flrCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256("FLR Collateral")
  );
  await contracts.flrCollateral.deployed();

  const aureiFactory = (await ethers.getContractFactory(
    "Aurei",
    signers.owner
  )) as AureiFactory;
  contracts.aurei = await aureiFactory.deploy();
  await contracts.aurei.deployed();

  const fxrpCollateralFactory = (await ethers.getContractFactory(
    "ERC20Collateral",
    signers.owner
  )) as Erc20CollateralFactory;
  contracts.fxrpCollateral = await fxrpCollateralFactory.deploy(
    contracts.registry.address,
    web3.utils.keccak256("FXRP Collateral"),
    contracts.aurei.address
  );
  await contracts.fxrpCollateral.deployed();

  return { contracts, signers };
};

export { deployBridge, deployCollateral };
