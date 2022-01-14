# Probity

[![Build](https://github.com/trustline-inc/aurei/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/aurei/actions/workflows/build.yml)

You can view the contract code in the [`contracts`](./contracts) folder. We will add a full API reference soon. You can find everything else in the [documentation&nbsp;📖 ](https://docs.trustline.co/trustline/-MX0imPEPxcvrbI-teLl/)

## Table of Contents

<!--ts-->

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
- [Contract Addresses](#contract-addresses)
  - [Coston](#coston-network)
  - [Songbird](#songbird-network)
  - [Flare](#flare-network)
  <!--te-->

## Installation

This project uses [Node.js](https://nodejs.org/en/) and assumes you have it installed.

Add `@trustline/probity` to your project with `npm` or `yarn`:

```
npm install @trustline-inc/probity --save
```

## Usage

Below is a code snippet that shows how to import the contract ABIs and call a contract method using [`ethers`](https://docs.ethers.io/v5/).

```javascript
import AureiABI from "@trustline-inc/aurei/artifacts/contracts/Aurei.sol/Aurei.json";
import { Contract } from "ethers";

const AUREI_ADDRESS = "<ADDRESS>";

const aurei = new Contract(AUREI_ADDRESS, AureiABI.abi, library.getSigner());
const totalSupply = await aurei.totalSupply();
console.log("Total supply:", totalSupply);
```

## Development

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

**Install NPM Modules**

Install node dependencies:

```
npm install
```

### IDE

[Visual Studio Code](https://code.visualstudio.com/) is the recommended IDE. Here's how to install Solidity language support:

```
code --install-extension JuanBlanco.solidity
```

Also, get the Prettier VSCode plugin:

```
code --install-extension esbenp.prettier-vscode
```

### Testing

Use the npm command to run tests on the local Hardhat network:

```
npm run test
```

### Publishing

We use [GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) to publish to the npm registry now. Below are the steps to publish a new version:

1. Update `version` in `package.json` and commit the change

2. Create a tag that matches `version` for the commit and run `git push --tags`

3. [Create a new release](https://github.com/trustline-inc/probity/releases/new) for the tagged version

## Deployment

### Local Deployment

You can deploy in the local network following these steps:

1. Run a local node.

Run a local [Flare](https://gitlab.com/flarenetwork/flare) node.

You should run an initial transaction before deploying contracts:

> This command can also be run when deploying.

```
npm run createInitialTx:local
```

2. Deploy to the local network.

Deploy the smart contract in the local network using the `deploy:local` script.

> Set the `FLARE_DIR` and `STABLECOIN` envioronment variables. Set `NATIVE_TOKEN_LOCAL` if you are deploying locally.

For example:

```
FLARE_DIR=~/Desktop/flare \
STABLECOIN=PHI \
NATIVE_TOKEN_LOCAL=SGB \
npm run deploy:local
```

If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first run `npm run createInitialTx:local`, which creates a genesis transaction in order for the network to start properly.

### Remote Deployment

There are currently three remote deployment target networks: `internal` and `coston`.

```
FLARE_DIR=~/Desktop/flare \
STABLECOIN=PHI \
NATIVE_TOKEN_LOCAL=SGB \
npm run deploy:internal
```

## Initialization

You can use the `initProbity` scripts to initialize the system with a new asset type., E.g.:

```
TOKEN=SGB \
FLARE_DIR=~/Desktop/flare \
yarn run initProbity:local
```

## Utility Scripts

Use `yarn run rateUpdater` to call `Teller.updateAccumulators()` every 5 seconds.

Use `yarn run priceUpdater` in the local environment to use the mock FTSO.

## Contract Addresses

### Internal Network

The internal network is only accessible to the Probity developers. The network native token is `FLR` and the stablecoin is `AUR`.

| Contract            | Address                                    |
| ------------------- | ------------------------------------------ |
| AUREI               | 0x91430aB2B8410940a0Ae1da459De58D796eB2be8 |
| FTSO                | 0x6F9c19281566A511f4759e4A852282a461955738 |
| REGISTRY            | 0xf8beCFAd24381b8d9D11EC0eC089a75b7b35Ef33 |
| PBT_TOKEN           | 0xbBAC3F9F87252347409bC2244F1969Ec24739168 |
| VAULT_ENGINE        | 0xCf73D7840Ac742cB79e807428842ee1F338711c7 |
| VAULT_MANAGER       | 0xD9bAdEd81E5FC370Ed0fd80686DE38cB2de658dA |
| NATIVE_TOKEN        | 0xEAb54Ca92E8CF81a1dB7540A436cbCf11024fb35 |
| ERC20_TOKEN         | 0x482685421cFD20dDF419BF7C64158Fcfe80beACe |
| FTSO_MANAGER        | 0xD7133e88b9a943Dedc69747c76a45AdC67b2CE20 |
| FTSO_REWARD_MANAGER | 0x189EAFEB0920D437af445E52c4ADB6FBEf9dc5D7 |
| TELLER              | 0xC2660f17307c39b2df122dC546D066C082750E5e |
| TREASURY            | 0xB4eAD06208b905268260331b743b9467855b1B3e |
| PRICE_FEED          | 0x7C70D3CEB0e5fCbfC733BB49D6F6E0cb6fa9b3B2 |
| AUCTIONEER          | 0x228bCc5F60c1aD8861f47a86EBd1E460e8D8a594 |
| LINEAR_DECREASE     | 0x44A9e6D18fE78f69c47f55200ad683827EA5ba7c |
| LIQUIDATOR          | 0x0A6cF9c85D8Ec0708f13D5dA4a1BeBC59e41785c |
| RESERVE_POOL        | 0xA6bc4831434576fC46251330ce71D074725c8F7a |
| MOCK_ERC20_TOKEN    | 0xFC349C8D9c0a1459eD72F9e0Bd154C4A35012097 |
| VP_TOKEN            | 0xAD667DF5CbC1Ca73bcF215f07DCFd118954f19d6 |
| MOCK_VP_TOKEN       | 0x4E6383F119360Ac39057605366C918A5938b55e6 |
| SHUTDOWN            | 0x9ca648296a1eF1b6B9EbD793b0bF990217A17fdA |
| LOW_APR             | 0xC5A76370c289b520123dA03e59455ef8D42A7693 |
| HIGH_APR            | 0x24b72A3456Ce140630693E7C386c94a52bD6162D |
| MOCK_PRICE_FEED     | 0xF8D43dd8bE88a8E085846CC77438a0166217aE0c |
| MOCK_AUCTIONEER     | 0xC9143C7822888d59371920cb1b401bFDC7D54C83 |
| MOCK_LIQUIDATOR     | 0xf633a04654b6591D91b33d3a07c9BcCfa3382DD3 |
| MOCK_RESERVE        | 0x0E32b69760Fd3af5d7D61c725BEd80b5eAfdD884 |

### Coston Network

The network native token is `CFLR` and the stablecoin is `AUR`.

| Contract        | Address                                    |
| --------------- | ------------------------------------------ |
| AUREI           | 0x7C552b35B4fD8455d4FF3C074E048D049c8365AF |
| REGISTRY        | 0x3774f6506d63e4Cc7EaBd019Ab702818F0c5509d |
| PBT_TOKEN       | 0x3C9b6B246D36Cf147137a20d0c283a8C549ffA07 |
| VAULT_ENGINE    | 0xB5932AA2EA5FC5b745DB3bF40C6F1fE065B504a2 |
| VAULT_MANAGER   | 0x6C1d416C4CEDf1F72AB8057D55486B4Ee8d85c8E |
| NATIVE_TOKEN    | 0xb9c836C7C6eBCB80C16Cc805cBF32Cc2e24c3145 |
| TELLER          | 0xCaC98E289BdA82296DCC3Cd591A421E76EdfE5A3 |
| TREASURY        | 0x9c837ddD17cFD3FAe8CD9859074003e9B006580b |
| PRICE_FEED      | 0x7D668b5Dc5D672eF639FAF25E80b5C0bC777D0CB |
| LINEAR_DECREASE | 0xAAc7Ac66B3a8f5Ac73B37540F7640A599C9ba1D4 |
| LIQUIDATOR      | 0x016c8BB5f00cf4D82e4BCc210DE399A0c75Bf647 |
| RESERVE_POOL    | 0xD25AC3E91704B8662b698cFc4dCa5a0129F3DD9E |
| SHUTDOWN        | 0x94c5E7B7c2a0C3EA2C8aa40eC5A9fE38370294B9 |
| LOW_APR         | 0x8D45f72a6928456225Cab1ABAe05143537f54040 |
| HIGH_APR        | 0x5B018404ad7861E086059223dCdD97ef48cF680f |

### Songbird Network

Songbird contract addresses will be listed here.

### Flare Network

Flare contract addresses will be listed here.
