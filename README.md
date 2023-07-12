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

| Contract        | Address                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Registry        | [0x72b96dF84644e9F5bC91228C52cA24D74aC04558](https://songbird-explorer.flare.network/address/0x72b96dF84644e9F5bC91228C52cA24D74aC04558) |
| Vault Engine    | [0x776C09f1640175f509c743C451Bb513ee13fF67A](https://songbird-explorer.flare.network/address/0x776C09f1640175f509c743C451Bb513ee13fF67A) |
| USD             | [0xc6e7DF5E7b4f2A278906862b61205850344D4e7d](https://songbird-explorer.flare.network/address/0xc6e7DF5E7b4f2A278906862b61205850344D4e7d) |
| PBT             | [0x7f2cF5bC5065BCaDF7713d11de41D9e0523D574e](https://songbird-explorer.flare.network/address/0x7f2cF5bC5065BCaDF7713d11de41D9e0523D574e) |
| Bond Issuer     | [0xe40eF80bF629d0DcbE731651397043afd1753355](https://songbird-explorer.flare.network/address/0xe40eF80bF629d0DcbE731651397043afd1753355) |
| Teller          | [0x1c86117F477D4C84e5954A85f3F1c787b67f1a31](https://songbird-explorer.flare.network/address/0x1c86117F477D4C84e5954A85f3F1c787b67f1a31) |
| Treasury        | [0x60b1d01AC1036906Eca859e6b55ca1bf9cAB92EF](https://songbird-explorer.flare.network/address/0x60b1d01AC1036906Eca859e6b55ca1bf9cAB92EF) |
| Price Feed      | [0x0EdF1C1BaE930B74f80371128239Ab5f584aADF1](https://songbird-explorer.flare.network/address/0x0EdF1C1BaE930B74f80371128239Ab5f584aADF1) |
| Auctioneer      | [0xa09dAB87b5dD723458d76ceC090E9224c80Be3a7](https://songbird-explorer.flare.network/address/0xa09dAB87b5dD723458d76ceC090E9224c80Be3a7) |
| Linear Decrease | [0xe442c0E9C8BeA6E96a2E2d8Fa29bD86c91aB487a](https://songbird-explorer.flare.network/address/0xe442c0E9C8BeA6E96a2E2d8Fa29bD86c91aB487a) |
| Liquidator      | [0xAb935B158336723448C676071B28717c2B135ffd](https://songbird-explorer.flare.network/address/0xAb935B158336723448C676071B28717c2B135ffd) |
| Reserve Pool    | [0xe2F72317D5F14Cc6d4b23019088768D456697fd6](https://songbird-explorer.flare.network/address/0xe2F72317D5F14Cc6d4b23019088768D456697fd6) |
| Low APR         | [0xFfA93AdFc1A8afda8214Dae9b00fA37d67786754](https://songbird-explorer.flare.network/address/0xFfA93AdFc1A8afda8214Dae9b00fA37d67786754) |
| High APR        | [0x4a23d4367Fc048B26ab9A14c33533EaF99b8b170](https://songbird-explorer.flare.network/address/0x4a23d4367Fc048B26ab9A14c33533EaF99b8b170) |
| SGB Manager     | [0x1aDF9d1AF441d4489ea2C6b9a7e944B1A59b0e98](https://songbird-explorer.flare.network/address/0x1aDF9d1AF441d4489ea2C6b9a7e944B1A59b0e98) |
| USD Manager     | [0xE1F322df0660470d1f8af66412FE631700a5eC95](https://songbird-explorer.flare.network/address/0xE1F322df0660470d1f8af66412FE631700a5eC95) |

### Flare Network

| Contract        | Address                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Registry        | [0xbF8A3CA285C7ccbACbC0c8666348f432060794Aa](https://explorer.flare.network/address/0xbF8A3CA285C7ccbACbC0c8666348f432060794Aa) |
| Vault Engine    | [0x29e42438a60EC8F5aacC51f826a0BB07F32507bb](https://explorer.flare.network/address/0x29e42438a60EC8F5aacC51f826a0BB07F32507bb) |
| USD             | [0x2De05d67bf2D03045684a48Ba269A09c51F53A6f](https://explorer.flare.network/address/0x2De05d67bf2D03045684a48Ba269A09c51F53A6f) |
| PBT             | [0x2d552d09c96A4c3d57924A636038CcceC2DF2c5e](https://explorer.flare.network/address/0x2d552d09c96A4c3d57924A636038CcceC2DF2c5e) |
| Bond Issuer     | [0x046508cc0be05F30741EABea5790bf4deFC6a079](https://explorer.flare.network/address/0x046508cc0be05F30741EABea5790bf4deFC6a079) |
| Teller          | [0xDBB461218eD84D712c2d57519c6672eF5F1529E9](https://explorer.flare.network/address/0xDBB461218eD84D712c2d57519c6672eF5F1529E9) |
| Treasury        | [0xF8b3093D277E5C8315CEFdB774d48d8665c28Bb8](https://explorer.flare.network/address/0xF8b3093D277E5C8315CEFdB774d48d8665c28Bb8) |
| Price Feed      | [0x6F1D557192f959339AfDF798F5Dba16c73C2A863](https://explorer.flare.network/address/0x6F1D557192f959339AfDF798F5Dba16c73C2A863) |
| Auctioneer      | [0xa09dAB87b5dD723458d76ceC090E9224c80Be3a7](https://explorer.flare.network/address/0xa09dAB87b5dD723458d76ceC090E9224c80Be3a7) |
| Linear Decrease | [0x166D6398fc2219268Fd049F3F6898841B86f0970](https://explorer.flare.network/address/0x166D6398fc2219268Fd049F3F6898841B86f0970) |
| Liquidator      | [0xAb935B158336723448C676071B28717c2B135ffd](https://explorer.flare.network/address/0xAb935B158336723448C676071B28717c2B135ffd) |
| Reserve Pool    | [0x6E4e94D9f9D36F1C4C9695fDA80cc9B5Ba16A3c5](https://explorer.flare.network/address/0x6E4e94D9f9D36F1C4C9695fDA80cc9B5Ba16A3c5) |
| Low APR         | [0x52031a7B712C412D546670Fa0A4140d4Dda91641](https://explorer.flare.network/address/0x52031a7B712C412D546670Fa0A4140d4Dda91641) |
| High APR        | [0x559409c4cE34efaDb000D00Ded0a7F9302a17f9C](https://explorer.flare.network/address/0x559409c4cE34efaDb000D00Ded0a7F9302a17f9C) |
| FLR Manager     | [0x3de0107eF69a5164B0e79daE9793B7C08f877aDb](https://explorer.flare.network/address/0x3de0107eF69a5164B0e79daE9793B7C08f877aDb) |
| USD Manager     | [0x2De05d67bf2D03045684a48Ba269A09c51F53A6f](https://explorer.flare.network/address/0x2De05d67bf2D03045684a48Ba269A09c51F53A6f) |

## License

[Apache 2.0](./LICENSE.md) © [Linqto Inc.](https://linqto.com)
