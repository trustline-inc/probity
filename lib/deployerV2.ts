import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import { artifacts, ethers, network, web3 } from "hardhat";
import * as dotenv from "dotenv";
import { Contract, ContractFactory } from "ethers";
dotenv.config();

import { bytes32, getNativeToken } from "./utils";
import { Environment } from "./types";

type ContractName = string; // PascalCase

const NATIVE_TOKEN = getNativeToken();

const contracts = {};

const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");

const convertUpperSnakeCaseToPascalCase = (name: ContractName): string => {
  return name
    .split("_")
    .map((substring) => substring.charAt(0).toUpperCase() + substring.slice(1))
    .join("");
};

const convertPascalCaseToUpperSnakeCase = (name: ContractName): string => {
  return name
    .split(/(?=[A-Z])/)
    .join("_")
    .toUpperCase();
};

const convertPascalCaseToCamelCase = (name: ContractName): string => {
  return name.chatAt(0).toLowerCase() + name.slice(1);
};

const isDeployed = async (address: string): boolean => {
  if (!address) return false;
  const code = await provider.getCode(address);
  return code !== "0x";
};

const contractExists = async (name: ContractName): boolean => {
  const address = process.env[convertPascalCaseToUpperSnakeCase(name)];
  if (await isDeployed(address)) {
    const [owner] = await ethers.getSigners();
    const { abi: contractInterface } = await artifacts.readArtifact(name);
    contracts[name] = new ethers.Contract(address, contractInterface, owner);
    return true;
  }
  return false;
};

const postDeploySteps = async (name: ContractName, params: any): void => {
  if (process.env.NODE_ENV !== "test") {
    const { address } = contracts[name];
    console.info("Contract deployed ✓");
    console.info({ name, address, params });
    if (hre.ethernal.api.auth.currentUser)
      await hre.ethernal.push({ name, address });
    await registerProbityContract(name);
  }
};

const registerProbityContract = async (name: ContractName) => {
  await contracts.Registry.register(
    bytes32(name),
    contracts[name].address,
    true
  );
};

const deployContract = async (
  name: ContractName,
  params: any,
  role?: string
): void => {
  if (!(await contractExists(name))) {
    const [owner] = await ethers.getSigners();
    const factory: ContractFactory = await ethers.getContractFactory(
      name,
      owner
    );
    const contract: Contract = await factory.deploy(...params);
    contracts[name] = contract;
    await contract.deployed();
    await postDeploySteps(name, params);
  } else {
    const address: string =
      process.env[convertPascalCaseToUpperSnakeCase(name)];
    console.info(`Contract ${name} is already deployed at ${address}`);
  }
};

const deploy = async (): void => {
  try {
    const [admin] = await ethers.getSigners();
    await deployContract("Registry", [admin.address]);
    await deployContract("USD", [contracts.Registry.address]);
    await deployContract("LowAPR", []);
    await deployContract("HighAPR", []);
    await deployContract("VaultEngineIssuer", [contracts.Registry.address]);
    await deployContract("NativeAssetManager", [
      contracts.Registry.address,
      bytes32(NATIVE_TOKEN),
      contracts.VaultEngineIssuer.address,
    ]);
    await deployContract("BondIssuer", [
      contracts.Registry.address,
      contracts.VaultEngineIssuer.address,
    ]);
    await deployContract("ReservePool", [
      contracts.Registry.address,
      contracts.VaultEngineIssuer.address,
      contracts.BondIssuer.address,
    ]);
    await deployContract("Teller", [
      contracts.Registry.address,
      contracts.VaultEngineIssuer.address,
      contracts.ReservePool.address,
      contracts.LowAPR.address,
      contracts.HighAPR.address,
    ]);
    await deployContract("LinearDecrease", []);
    await deployContract("PriceFeed", [
      contracts.Registry.address,
      contracts.VaultEngineIssuer.address,
    ]);
    await deployContract("Treasury", [
      contracts.Registry.address,
      contracts.USD.address,
      contracts.VaultEngineIssuer.address,
    ]);
    await deployContract("Liquidator", [
      contracts.Registry.address,
      contracts.VaultEngineIssuer.address,
      contracts.ReservePool.address,
      contracts.PriceFeed.address,
      contracts.Treasury.address,
    ]);
    await deployContract("Auctioneer", [
      contracts.Registry.address,
      contracts.VaultEngineIssuer.address,
      contracts.LinearDecrease.address,
      contracts.PriceFeed.address,
      contracts.Liquidator.address,
    ]);
    await deployContract("ERC20AssetManager", [
      contracts.Registry.address,
      bytes32("USD"),
      contracts.USD.address,
      contracts.VaultEngineIssuer.address,
    ]);
  } catch (error) {
    console.error(error);
  }
};

export { deploy };
