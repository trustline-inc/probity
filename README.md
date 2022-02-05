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
import AureiABI from "@trustline-inc/probity/artifacts/contracts/tokens/Aurei.sol/Aurei.json";
import { Contract } from "ethers";

const AUREI_ADDRESS = "0xBB62591BdEd66c1df6C3e9A912f3eC8c4F234455";

const aureiErc20 = new Contract(
  AUREI_ADDRESS,
  AureiABI.abi,
  library.getSigner()
);
const totalSupply = await aureiErc20.totalSupply();
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
STABLECOIN=AUR \
NATIVE_TOKEN_LOCAL=CFLR \
npm run deploy:local
```

If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first run `npm run createInitialTx:local`, which creates a genesis transaction in order for the network to start properly.

### Remote Deployment

There are currently three remote deployment target networks: `internal` and `coston`.

```
FLARE_DIR=~/Desktop/flare \
STABLECOIN=AUR \
NATIVE_TOKEN_LOCAL=CFLR \
npm run deploy:internal
```

## Initialization

You can use the `initProbity` scripts to initialize the system with a new asset type., E.g.:

```
NATIVE_TOKEN=CFLR \
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

| Contract            | Address                                    |
| ------------------- | ------------------------------------------ |
| AUREI               | 0xBB62591BdEd66c1df6C3e9A912f3eC8c4F234455 |
| FTSO                | 0xc1678E3a95fF110179D51C900C862a752e8CD660 |
| REGISTRY            | 0x4Bf20eb2110500D5BE4978855D0C7898fE85d5c5 |
| PBT_TOKEN           | 0xBf7399C8E9b6c401ce581f6Cf7c1b4907E251F7a |
| VAULT_ENGINE        | 0x075CDcAca8e540fe073cB8328aA371C87F1955d3 |
| VAULT_MANAGER       | 0x486FC5d6bD9a4CaadEfD2f6206df396d3C4fBE44 |
| NATIVE_TOKEN        | 0x123A5d37F8B474f5E291b6042b87Cfe6d26159C4 |
| ERC20_TOKEN         | 0xd2f94A4b4C22e0d74e7A744A3c283AEA2b18dd09 |
| FTSO_MANAGER        | 0x6C7448614648783Df9831C7635126df10e1d3AE7 |
| FTSO_REWARD_MANAGER | 0x916F7A019aA1E2458a5d711c208B0D07048b5a63 |
| TELLER              | 0x436C47669AFBaeDD2E65DC1c60221EA97ff54ddf |
| TREASURY            | 0x585BCE8B9a0546b3d6c80b92B11B3D78EEA290d5 |
| PRICE_FEED          | 0x1c4eE03075C05079aaf7A67FB23C2085cf76aE37 |
| AUCTIONEER          | 0x7182354F1Aa31c72Dc8fC1D204E5d051d9D8F6F6 |
| LINEAR_DECREASE     | 0xf6531e328dc6C0dcb073cf2E1e2E66795002CBc5 |
| LIQUIDATOR          | 0x95690fB608383906A7a9baB846Fb1930cbF50A06 |
| RESERVE_POOL        | 0xf62aCF6B8209De7Bf50cC287673BBF8DdeF8E3b4 |
| MOCK_ERC20_TOKEN    | 0xca033b1253b9566c944417d93f3DB99777C911ca |
| VP_TOKEN            | 0xC6507D30789E9826818761f19E7f27d7F7e91604 |
| MOCK_VP_TOKEN       | 0xc74687A2192F6E5Dc9C4D70C06131105e763c74c |
| SHUTDOWN            | 0xEf89cd3D6A6E070F115C6C4EfFbAF9A349FbC413 |
| LOW_APR             | 0xf53B9119a8e270B0A896421E489bba76769e8c7d |
| HIGH_APR            | 0xf0cF8f3129094Be3Ac876bEaE18868c511D02865 |
| MOCK_PRICE_FEED     | 0x71C4B1da20ac02019FBb9427F72Da823251F3C8f |
| MOCK_AUCTIONEER     | 0xB50fB655F7860d3C6620d5753D5AFAa406bE2d07 |
| MOCK_LIQUIDATOR     | 0x1E62099670f985835d03328490F55FB57092AC60 |
| MOCK_RESERVE        | 0x2327da65Be32dc1B06177f02587B3a5f32752825 |

### Songbird Network

Songbird contract addresses will be listed here.

### Flare Network

Flare contract addresses will be listed here.
