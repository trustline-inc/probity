/**
 * Deploy A new Gnosis Safe (Multi-Sig) Wallet Contract
 *  Requirements:
 *     - Make sure the Gnosis's safe contract system is deployed. https://github.com/gnosis/safe-contracts/tree/v1.3.0#deploy
 *     - Gather the list of addresses for Owner
 *     - Threshold number for execution
 *
 * Make sure the variables have correct value before running the script
 */

import "@nomiclabs/hardhat-ethers";
require("@nomiclabs/hardhat-waffle");
const { ethers } = require("hardhat");
import EthersAdapter from "@gnosis.pm/safe-ethers-lib";
import Safe, {
  SafeFactory,
  SafeAccountConfig,
  ContractNetworksConfig,
} from "@gnosis.pm/safe-core-sdk";

/**
 * Initialize the system into a ready state
 */
const deploySafe = async () => {
  // Make sure these following variables have correct values before running the script
  const MULTI_SEND_ADDRESS = "0xeb47A5C561b40057733B38B5839EF7efCdE25860";
  const SAFE_MASTER_COPY = "0x7F3951BD4B5939348CE1546B247E988FA61aeeA5";
  const SAFE_PROXY_FACTORY_ADDRESS =
    "0x32dfE359aa1E100Ba8CfBF5f38BcBdb3f55e8a06";

  const OWNER_LIST = [
    "0xff57CaF5B871db64F2a7F4C5bc2d17A5E666F7E8",
    "0xDEc68161D56397B682841a4666706c1Dfc4F63a8",
    "0x8e564b482CA70dE51D0d69c9668940A5fE77f5D6",
  ];
  const THRESHOLD = 1;

  console.info("");
  console.info(`These are the variables provided`);
  console.info(`--------------------------------`);
  console.info(`Multi Send Address \t \t: ${MULTI_SEND_ADDRESS}`);
  console.info(`Safe Master Copy \t \t: ${SAFE_MASTER_COPY}`);
  console.info(`Safe Proxy Factory Address \t: ${SAFE_PROXY_FACTORY_ADDRESS}`);
  console.info(`Owner List \t \t \t: ${OWNER_LIST}`);
  console.info(`Threshold \t \t \t: ${THRESHOLD}`);
  console.info("\n");
  console.info(`Now Deploying....`);

  const [deployer] = await ethers.getSigners();

  const ethAdapter = new EthersAdapter({
    ethers,
    signer: deployer,
  });

  const id = await ethAdapter.getChainId();

  const contractNetworks: ContractNetworksConfig = {
    [id]: {
      multiSendAddress: MULTI_SEND_ADDRESS,
      safeMasterCopyAddress: SAFE_MASTER_COPY,
      safeProxyFactoryAddress: SAFE_PROXY_FACTORY_ADDRESS,
    },
  };

  const safeFactory = await SafeFactory.create({
    ethAdapter,
    contractNetworks,
  });
  const safeAccountConfig: SafeAccountConfig = {
    owners: OWNER_LIST,
    threshold: THRESHOLD,
  };

  const safeSdk: Safe = await safeFactory.deploySafe({ safeAccountConfig });
  console.info(
    `Deployment Successful, New wallet Address : ${safeSdk.getAddress()}`
  );
};

deploySafe();
