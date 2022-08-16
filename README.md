# Probity

[![Build](https://github.com/trustline-inc/probity/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/probity/actions/workflows/build.yml)

You can view the contract code in the [`contracts`](./contracts) folder. We will add a full API reference soon. You can find everything else in the [documentation&nbsp;📖 ](https://docs.trustline.co/trustline/-MX0imPEPxcvrbI-teLl/)

## Table of Contents

<!--ts-->

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
  - [Installation](#installation-1)
  - [IDE](#ide)
  - [Testing](#testing)
  - [Publishing](#publishing)
- [Deployment](#deployment)
  - [Local](#local-deployment)
  - [Remote](#remote-deployment)
- [Initialization](#initialization)
- [Utility Scripts](#utility-scripts)
  - [Rate Updater](#rate-updater)
  - [Price Updater](#price-updater)
- [Contract Addresses](#contract-addresses)
  - [Coston](#coston-network)
  - [Songbird](#songbird-network)
  - [Flare](#flare-network)
  <!--te-->

## Overview

This repository contains the source code for the Probity smart contract system (AKA "protocol") and examples to jumpstart development with Probity.

## NodeJS Package

The NodeJS package provides contract ABIs for Probity.

### Installation

This project uses [Node.js](https://nodejs.org/en/) and assumes you have it installed.

Add `@trustline-inc/probity` to your project with `npm` or `yarn`:

```
npm install @trustline-inc/probity --save
```

### Usage

Below is a code snippet that shows how to import the contract ABI and call a contract method using [`ethers`](https://docs.ethers.io/v5/).

```javascript
/**
 * This example gets the total supply of the USD token by calling the `totalSupply` method
 * on the ERC20 contract at `USD_ERC20_ADDRESS`
 */
import UsdABI from "@trustline-inc/probity/artifacts/contracts/tokens/Usd.sol/USD.json";
import { Contract } from "ethers";

const USD_ERC20_ADDRESS = "0xBB62591BdEd66c1df6C3e9A912f3eC8c4F234455";

const usdErc20 = new Contract(
  USD_ERC20_ADDRESS,
  UsdABI.abi,
  library.getSigner()
);
const totalSupply = await usdErc20.totalSupply();
console.log("Total supply:", totalSupply);
```

## Development

### Requirements

- NodeJS
- Yarn

### Recommended IDE

[Visual Studio Code](https://code.visualstudio.com/) is the recommended IDE. Here's how to install Solidity language support:

```
code --install-extension JuanBlanco.solidity
```

Also, get the Prettier VSCode plugin:

```
code --install-extension esbenp.prettier-vscode
```

### Installation

**Solidity Installation**

Make sure the Solidity compiler is installed. The compiler version must be >= `0.8.4`.

To install `solc` run this command:

```
npm install -g solc
```

You can verify the version with like so:

```
solcjs --version
```

**Install Project Dependencies**

Install node dependencies:

```
yarn
```

### Testing

Use the npm command to run tests on the local Hardhat network:

```
npm run test
```

### Publishing

We use [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) to publish to the npm registry now. Below are the steps to publish a new version:

1. Update `version` in `package.json` and commit the change

2. Create a tag that matches `version` for the commit and run `git push --follow-tags`

3. [Create a new release](https://github.com/trustline-inc/probity/releases/new) for the tagged version

### Running Locally

Run a local [Flare](https://gitlab.com/flarenetwork/flare) node.

Hardhat will use the account listed in `hardhat.config.ts` for the network. You'll want to make sure that account is funded first.

You should run an initial transaction before deploying contracts:

> You should also run this for the `internal` network

```
npm run createInitialTx <network>
```

### Deployment

Deploy the smart contract in the local network using the `deploy` script.

> Set the `FLARE_DIR` envioronment variables. Optionally set `NATIVE_TOKEN` if you are deploying locally.

For example:

```
NATIVE_TOKEN=<symbol> FLARE_DIR=~/Desktop/flare npm run deploy:<dev|prod> <network>
```

If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first run `npm run createInitialTx local`, which creates a genesis transaction in order for the network to start properly.

### Initialization

You can use a script to initialize the system with a new asset type.

> Override the native token on the `local` or `internal` networks with `NATIVE_TOKEN=<CFLR|SGB|FLR>`.

```
NATIVE_TOKEN=<symbol> FLARE_DIR=~/Desktop/flare yarn run initialize <network>
```

## Administrator Tools

### System Info

Use this command to paste the output into [probity-ui](https://github.com/trustline-inc/probity-ui):

```
yarn run getSystemInfo <network>
```

### Fiat Tokens

The system admin (AKA "governance address") is able to issue fiat tokens for lending in Probity when using `VaultEngineIssuer`.

```
yarn run issuance <network>
```

### Rate Updater

Run this command to update the debt and equity rate accumulators every 5 seconds.

> Note: You must first commit funds to the lending pool, otherwise you will get execution error `Teller/updateAccumulators: Total equity cannot be zero`

```
yarn run rateUpdater <network>
```

### Price Updater

Run this command in the local environment to use the mock FTSO.

```
yarn run priceUpdater <network>
```

### Allow Address

Edit `./scripts/whitelistAddress.ts` to update the new allowed address, then run this:

```
yarn run whitelistAddress <network>
```

## Contract Addresses

### Internal Network

The internal network is only accessible to the Probity developers. The network native token depends on the chain ID.

Since we're running chain ID 16, the native token is `CFLR`.

| Contract             | Address                                    |
| -------------------- | ------------------------------------------ |
| USD                  | 0xCB0A71445F2791740054ED2208182512AbbdD795 |
| BOND_ISSUER          | 0xdca77A48c628a50516a9cBeaB4F37c389956a1eb |
| FTSO                 | 0xb446EA59ac7bbf0eFcab8629f087C19E8e011601 |
| REGISTRY             | 0x03eA808a61c4b2000d0f17552bCc37F49c3A82ca |
| PBT_TOKEN            | 0x5F9710c8A313E64251359b042791749830E41E4a |
| VAULT_ENGINE         | 0x1541b3C9b6285716Be6dc152aE4dfd9940cf99A4 |
| NATIVE_ASSET_MANAGER | 0xc62B7C8FA1D0634f45c0dB07ea123ccF3D3907E6 |
| ERC20_ASSET_MANAGER  | 0x2F10D1133369D7390b8b8cac721Ef63f86330D6e |
| FTSO_MANAGER         | 0x9E4357cAF8952cA0ad9e1F770120a3f02857D942 |
| FTSO_REWARD_MANAGER  | 0x16f905a8F3E84D18980406eF06008f8E0BF188eb |
| TELLER               | 0xc9fbEce4d6B1C66B421c3D4ba7aa72ABee0f42E0 |
| TREASURY             | 0x89341798f5B2CC687D721BAe1B26210e4d5eB4cA |
| PRICE_FEED           | 0xD8EFDec425c9b1d7D6F0710348286677E3eeeF79 |
| AUCTIONEER           | 0x075510e438149EFceD44751ae56c8434BbC7fD9e |
| LINEAR_DECREASE      | 0x5E8DB7A9a2Bf7e33fdb7dB8cd6F53BaEDde20f45 |
| LIQUIDATOR           | 0x21439178E443dF761f971D658618e55a31Fb76dE |
| RESERVE_POOL         | 0x00590d131740D1Bfcdfca4a174e6bB1c78C5feA3 |
| MOCK_ERC20_TOKEN     | 0x9FF5DEbFA4872b37f2e1cfac5ad87766337F5E0d |
| VP_ASSET_MANAGER     | 0xf75c87C3Bf0c8f4C0a798E30D7B664c1E0855a97 |
| MOCK_VP_TOKEN        | 0xF452fcA2c0232e5326C449647BBA40292AA0D60A |
| SHUTDOWN             | 0x4C044df4613C5b92ee64e859Da165A8c52269Cc7 |
| LOW_APR              | 0x80685Aa8a6029cff21973842EBa35c8E16d429a1 |
| HIGH_APR             | 0x848D05D7C2BBb7616c0Fa3d5834931B8b300B224 |
| MOCK_PRICE_FEED      | 0xAd83B773175244D1C841e9d0e1FD02907dA4F8a0 |
| MOCK_AUCTIONEER      | 0xd58f5e8fEb5992B4f138e6C0DB2EbBB0Ed162b93 |
| MOCK_LIQUIDATOR      | 0xEd1e71855c8cC11E5d9aeF1BD7ecC31df0B63261 |
| MOCK_RESERVE         | 0x7F8ADFB2a8a0F393c32b0DEe215F707454E03913 |
| MOCK_BOND_ISSUER     | 0xbd6F1834458C55D9FDa43a2987910A39eF8C7565 |

### Coston Network

The network native token is `CFLR`.

| Contract             | Address                                    |
| -------------------- | ------------------------------------------ |
| USD                  | 0x137ABa115B5321f4fAae99148eAdaA99e06e5462 |
| BOND_ISSUER          | 0x9d9dDFD7a3Bc2aEc0E2850DB196601fB60289e2e |
| FTSO                 | 0xC21F9D217DEc97d4C21eaD22fA9513C7A3AF7546 |
| REGISTRY             | 0x02DDB098A9117858DdB91b950653F41Cde7fa2dc |
| PBT                  | 0xe6cf0E52C456872a8de869bB10eC9986000A7516 |
| VAULT_ENGINE         | 0x4B79710B9CDA9901Ca28693ecA84CC131CA85C9b |
| NATIVE_ASSET_MANAGER | 0xb387b72a4074aB5924973510c2E20722DAbBc710 |
| USD_MANAGER          | 0xd20b52fe4D1551AC4E09Ca035ccAF6d7F6D8EB86 |
| FTSO_MANAGER         | 0x7f51B6775B417Ff193e07949e8D05c50E03F32f7 |
| FTSO_REWARD_MANAGER  | 0xb03c471771080D14240b5D5E9D0f8b6C9e1E0a63 |
| TELLER               | 0x06BcB41816c2B3AB7555a460ef3dA9752E83A2df |
| TREASURY             | 0x5F69ebAe912879D9A6E48820D00a26400f3FAe27 |
| PRICE_FEED           | 0xB221725772963BbeD981560385cac09d276Bd2d1 |
| AUCTIONEER           | 0x73Bb9cF3e66F378d4517Cfb600bA8922908310e0 |
| LINEAR_DECREASE      | 0xD64c5092363d8735C90A4Bc65AAb01E2FBC5Ed36 |
| LIQUIDATOR           | 0x0F6553811ce1C3b31c73B90849D9FED4dcAC2A98 |
| RESERVE_POOL         | 0xFb8c2f015B3ce2A760318c6C3d2C4D4d1de3A17c |
| MOCK_ERC20_TOKEN     | 0x7eA6FD5a6F3Af6205577063BB932fB1235041A4e |
| VP_ASSET_MANAGER     | 0x3FDf86Ab1D54868B559D7ce6292a3d3Bb3ba8d8c |
| MOCK_VP_TOKEN        | 0x2D8cBf7E05D3Fa29A292b9782966486e5aB01af7 |
| SHUTDOWN             | 0x7576E4Bd5ab73DB89Ad3430bbaDA536D00E56A47 |
| LOW_APR              | 0x02866fee248FFC9d2d18b2ceA08DF2eC48d7DaaA |
| HIGH_APR             | 0xD9d06Ac2090361A7b143D832f2cA52dbb1BF1305 |
| MOCK_PRICE_FEED      | 0xdF137365aA7bb9ED6942f9D9c2A1dAe59A36cFF3 |
| MOCK_AUCTIONEER      | 0x0Eadc7474a46c65ffa79D8b111a0bB7fFdba1eEe |
| MOCK_LIQUIDATOR      | 0xA12E07Df1674E6490Bc8A944EfEb1473F372e12a |
| MOCK_RESERVE         | 0xD84a330c3D105D4D86b4fCaA9716f0c85C99C400 |
| MOCK_BOND_ISSUER     | 0xaAD7aD208C9E90D8290Ef515E3bc5bf40B44fD68 |

### Songbird Network

The network native token is `SGB`.

| Contract             | Address                                    |
| -------------------- | ------------------------------------------ |
| USD                  | 0x5322E9cE9DFc60372222F899D2B3683D45D9C167 |
| BOND_ISSUER          | 0x6A40Ed2aD0684a9C8ABAd1642a99EE1cd37B6B46 |
| REGISTRY             | 0xCA33D13E5D03b262C06E98244cb47328d5f890f3 |
| PBT_TOKEN            | 0x9E9600168c3b6FA0d3A779956969c41aaD21e1a1 |
| VAULT_ENGINE         | 0x02b1A3b0efB8D04A3d91e3CD548885bC4c4bC1c7 |
| NATIVE_ASSET_MANAGER | 0x836BD8CBf5baFc971012397879490Ef7Ede64a38 |
| TELLER               | 0x25bb8E3bf6228e9cd4F8A29337438357BdDbDfeF |
| TREASURY             | 0x08E6eC157F126d30D3E2Ba0f9c3F95Fb53bd0613 |
| PRICE_FEED           | 0x51D82d9d17fAdaC40cDef03cf9CB07b1Fb65563C |
| AUCTIONEER           | 0x80584b42bC51219fB5556e27fa6c16ADbaEA1E53 |
| LINEAR_DECREASE      | 0xbB5609C986Fb07f700f6856328D06A8B9296d275 |
| LIQUIDATOR           | 0xfE850285031a976de274b969d098fBb9E94fc7bb |
| RESERVE_POOL         | 0x13F332fd05F85909E1f1a74949c30fC74D9Ce3B1 |
| SHUTDOWN             | 0x91f65dE41ED6588733f2C7723ab3af378Af81a92 |
| LOW_APR              | 0xd67Dfa1081eda1b74c3eADd4432D87d1fE79415A |
| HIGH_APR             | 0x6e8aBb2e56415f9Ab3Fee3CC3189607dC14eC560 |

### Flare Network

Flare contract addresses will be listed here.
