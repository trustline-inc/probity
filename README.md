# Probity

[![Build](https://github.com/trustline-inc/probity/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/probity/actions/workflows/build.yml) <img alt="NPM" src="https://img.shields.io/npm/l/@trustline/probity">

> Probity is a protocol for asset-based lending designed to run on EVM-compatible distributed ledgers.

You can view the contract code in the [`contracts`](./contracts) folder and the audit report can be found in the [`audits`](./audits) folder. You can find everything else in the protocol [documentation](https://docs.trustline.co/products/).

## Usage

This repository contains the source code for the Probity smart contract system and examples to jumpstart development with Probity. The contract ABIs are accessible through the [`@trustline/probity`](https://www.npmjs.com/package/@trustline/probity) NPM package.

### Installation

This project uses [Node.js](https://nodejs.org/en/) and assumes you have it installed.

Add `@trustline/probity` to your project with `npm` or `yarn`:

```
npm install @trustline/probity --save
```

### Example

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

## Administration

See the [administration guide](./docs/administration.md) for details.

## Contract Addresses

### Coston2 Network

| Contract        | Address                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Registry        | [0x3Aa5ebB10DC797CAC828524e59A333d0A371443c](https://coston2-explorer.flare.network/address/0x3Aa5ebB10DC797CAC828524e59A333d0A371443c) |
| Vault Engine    | [0xc5a5C42992dECbae36851359345FE25997F5C42d](https://coston2-explorer.flare.network/address/0xc5a5C42992dECbae36851359345FE25997F5C42d) |
| USD             | [0xc6e7DF5E7b4f2A278906862b61205850344D4e7d](https://coston2-explorer.flare.network/address/0xc6e7DF5E7b4f2A278906862b61205850344D4e7d) |
| PBT             | [0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1](https://coston2-explorer.flare.network/address/0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1) |
| Bond Issuer     | [0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB](https://coston2-explorer.flare.network/address/0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB) |
| Teller          | [0xf5059a5D33d5853360D16C683c16e67980206f36](https://coston2-explorer.flare.network/address/0xf5059a5D33d5853360D16C683c16e67980206f36) |
| Treasury        | [0x0E801D84Fa97b50751Dbf25036d067dCf18858bF](https://coston2-explorer.flare.network/address/0x0E801D84Fa97b50751Dbf25036d067dCf18858bF) |
| Price Feed      | [0x4826533B4897376654Bb4d4AD88B7faFD0C98528](https://coston2-explorer.flare.network/address/0x4826533B4897376654Bb4d4AD88B7faFD0C98528) |
| Auctioneer      | [0x809d550fca64d94Bd9F66E60752A544199cfAC3D](https://coston2-explorer.flare.network/address/0x809d550fca64d94Bd9F66E60752A544199cfAC3D) |
| Linear Decrease | [0x998abeb3E57409262aE5b751f60747921B33613E](https://coston2-explorer.flare.network/address/0x998abeb3E57409262aE5b751f60747921B33613E) |
| Liquidator      | [0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00](https://coston2-explorer.flare.network/address/0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00) |
| Reserve Pool    | [0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9](https://coston2-explorer.flare.network/address/0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9) |
| Low APR         | [0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f](https://coston2-explorer.flare.network/address/0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f) |
| High APR        | [0x7a2088a1bFc9d81c55368AE168C2C02570cB814F](https://coston2-explorer.flare.network/address/0x7a2088a1bFc9d81c55368AE168C2C02570cB814F) |
| C2FLR Manager   | [0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E](https://coston2-explorer.flare.network/address/0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E) |
| USD Manager     | [0x1291Be112d480055DaFd8a610b7d1e203891C274](https://coston2-explorer.flare.network/address/0x1291Be112d480055DaFd8a610b7d1e203891C274) |

### Songbird Network

Songbird contract addresses will be listed here. The Songbird network's native token is `SGB`.

### Flare Network

Flare contract addresses will be listed here. The Flare network's native token is `FLR`.

## License

[Apache 2.0](./LICENSE.md) © [Linqto Inc.](https://linqto.com)
