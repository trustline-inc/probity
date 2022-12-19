# Probity

[![Build](https://github.com/trustline-inc/probity/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/probity/actions/workflows/build.yml) <img alt="NPM" src="https://img.shields.io/npm/l/@trustline/probity">

You can view the contract code in the [`contracts`](./contracts) folder and the audit report can be found in the [`audits`](./audits) folder. You can find everything else in the [documentation&nbsp;📖 ](https://docs.trustline.co/trustline/-MX0imPEPxcvrbI-teLl/)

## Table of Contents

<!--ts-->

- [Quick Start](#quick-start)
  - [Installation](#installation)
  - [Usage](#usage)
- [Development](#development)
- [Deployment](#deployment)
- [Initialization](#initialization)
- [Administration](#administration)
  - [System Info](#system-info)
  - [Fiat Tokens](#fiat-tokens)
  - [Rate Updater](#rate-updater)
  - [Price Updater](#price-updater)
  - [Allow Address](#allow-address)
- [Contract Addresses](#contract-addresses)
  - [Coston 2](#coston-2-network)
  - [Songbird](#songbird-network)
  - [Flare](#flare-network)
- [License](#license)

<!--te-->

## Quick Start

This repository contains the source code for the Probity smart contract system and examples to jumpstart development with Probity. The contract ABIs are accessible through the [`@trustline/probity`](https://www.npmjs.com/package/@trustline/probity) NPM package.

### Installation

This project uses [Node.js](https://nodejs.org/en/) and assumes you have it installed.

Add `@trustline/probity` to your project with `npm` or `yarn`:

```
npm install @trustline/probity --save
```

### Usage

Below is a code snippet that shows how to import the contract ABI and call a contract method using [`ethers`](https://docs.ethers.io/v5/).

```javascript
/**
 * This example gets the total supply of the USD token by
 * calling the `totalSupply` method on the ERC20 contract at
 * <address>.
 */
import UsdABI from "@trustline/probity/artifacts/contracts/tokens/Usd.sol/USD.json";
import { Contract } from "ethers";

const USD_ERC20_ADDRESS = "<address>";

const usdErc20 = new Contract(
  USD_ERC20_ADDRESS,
  UsdABI.abi,
  library.getSigner()
);
const totalSupply = await usdErc20.totalSupply();
console.log("Total supply:", totalSupply);
```

## Development

See the [developer guide](./docs/development.md) for details.

## Deployment

See the [deployment guide](./docs/deployment.md) for details.

## Initialization

You can use a script to initialize the system with a new asset type.

> Override the native token on the `local` or `internal` networks with `NATIVE_TOKEN=<SGB|FLR|XRP|ETH>`.

```
NATIVE_TOKEN=<symbol> yarn run initialize <network>
```

## Administration

### System Info

Use this command to paste the output into [trustline-inc/probity-ui](https://github.com/trustline-inc/probity-ui):

```
yarn run getSystemInfo <network>
```

### Fiat Tokens

The system admin (also referred to as the "governance address") is able to issue fiat tokens for lending in Probity when using `VaultEngineIssuer`.

```
yarn run issuance <network>
```

### Rate Updater

Run this command to update the debt and equity rate accumulators every 5 seconds.

> Note: You must first commit funds to the lending pool, otherwise you will get an execution error.

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

### Coston 2 Network

> Note: This is a test network.

Coston 2 contract address will be listed here. The network native token is `CFLR`.

### Songbird Network

Songbird contract addresses will be listed here. The Songbird network's native token is `SGB`.

### Flare Network

Flare contract addresses will be listed here. The Flare network's native token is `FLR`.

## License

[Apache 2.0](./LICENSE.md) © [Linqto Inc.](https://linqto.com)
