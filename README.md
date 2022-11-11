# Probity

[![Build](https://github.com/trustline-inc/probity/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/probity/actions/workflows/build.yml)

You can view the contract code in the [`contracts`](./contracts) folder. We will add a full API reference soon. You can find everything else in the [documentation&nbsp;📖 ](https://docs.trustline.co/products/)

## Table of Contents

<!--ts-->

- [Overview](#overview)
- [NPM Package](#npm-package)
  - [Installation](#installation)
  - [Usage](#usage)
- [Development](#development)
  - [Requirements](#requirements)
  - [Recommended IDE](#recommended-ide)
  - [Installation](#installation-1)
  - [Local Network](#local-network)
  - [Testing](#testing)
  - [Publishing](#publishing)
  - [Deployment](#deployment)
  - [Initialization](#initialization)
- [Administrator Tools](#administrator-tools)
  - [System Info](#system-info)
  - [Fiat Tokens](#fiat-tokens)
  - [Rate Updater](#rate-updater)
  - [Price Updater](#price-updater)
  - [Allow Address](#allow-address)
- [Contract Addresses](#contract-addresses)
  - [Internal Network](#internal-network)
  <!--te-->

## Overview

This repository contains the source code for the Probity smart contract system (AKA "protocol") and examples to jumpstart development with Probity.

## NPM Package

The NPM package provides contract ABIs for Probity.

### Installation

Add `@trustline-inc/probity` to your project with `npm`:

```
npm install @trustline-inc/probity --save
```

Or with `yarn`:

```
yarn add @trustline-inc/probity
```

### Usage

Below is a code snippet that shows how to import the contract ABI and call a contract method using [`ethers`](https://docs.ethers.io/v5/).

```javascript
/**
 * This example gets the total supply of the USD token by calling the `totalSupply` method
 * on the ERC20 contract at `USD_ADDRESS`
 */
import UsdABI from "@trustline-inc/probity/artifacts/contracts/tokens/Usd.sol/USD.json";
import { Contract } from "ethers";

const USD_ADDRESS = "0xBB62591BdEd66c1df6C3e9A912f3eC8c4F234455";

const usd = new Contract(USD_ADDRESS, UsdABI.abi, library.getSigner());
const totalSupply = await usd.totalSupply();
console.log("Total supply:", totalSupply);
```

## Development

### Requirements

- NodeJS
- Yarn

### Recommended IDE

[Visual Studio Code](https://code.visualstudio.com/) is the recommended IDE. Here's how to install Solidity language support:

We recommend installing the [Hardhat + Solidity](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity) IDE extension from the VSCode marketplace.

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

### Local Network

To start a local network, use `yarn run node`. Alternatively, you can [run a local Flare network](https://gitlab.com/flarenetwork/flare).

Using the `flare_local` network will require you to create an initial transaction first. You can do so like this:

```
npm run createInitialTx <network>
```

### Testing

Use the npm command to run tests on the in-process Hardhat network:

```
npm run test
```

### Publishing

We use [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) to publish to the npm registry now. Below are the steps to publish a new version:

1. Update `version` in `package.json` and commit the change

2. Create a tag that matches `version` for the commit and run `git push --follow-tags`

3. [Create a new release](https://github.com/trustline-inc/probity/releases/new) for the tagged version

### Deployment

If you're deploying to a local Hardhat node, you can use simply do:

```
ETHERNAL_PASSWORD=<password> bash ./init.sh
```

To deploy to other networks, use the `deploy` script.

> If you're using the `flare_local` network, set the `FLARE_DIR` envioronment variable.

For example:

```
NATIVE_TOKEN=<symbol> npm run deploy:<dev|prod> <network>
```

If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first run `npm run createInitialTx local`, which creates a genesis transaction in order for the network to start properly.

### Initialization

You can use a script to initialize the system with a new asset type.

> Override the native token on the `local` or `internal` networks with `NATIVE_TOKEN=<SGB|FLR|XRP|ETH>`.

```
NATIVE_TOKEN=<symbol> yarn run initialize <network>
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

> NOTE: Contracts have not been deployed to the internal network.

| Contract | Address |
| -------- | ------- |
|          |         |

Other networks to be introduced in time.
