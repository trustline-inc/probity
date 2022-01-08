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

2. Deploy to the network.

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

## Initialization

You can use the `initProbity` script to initialize the system with a new collateral type.

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

The internal network is only accessible to the Probity developers.

| Contract            | Address                                    |
| ------------------- | ------------------------------------------ |
| AUREI               | 0xe298D0B928c1c57F30d20Afa91126e161b64A17f |
| FTSO                | 0x6517Eaa62cFF4D76e4cCf64fBc5EaB498505ebe5 |
| REGISTRY            | 0x41eD6D359d1307F919839e915013DECa3a6df89c |
| PBT_TOKEN           | 0x9fBc3E0fF29eAFA02a64f398ffB0b905BA0f9252 |
| VAULT_ENGINE        | 0x48599a9a544AC803dBE236BbF35f150eb6B5678F |
| NATIVE_TOKEN        | 0xa2330d4A559A76B2eDF6fF24A12F5e8Dd9B0d55F |
| ERC20_TOKEN         | 0x3F06874D9D5966be21259F160e2e6E4F36a25085 |
| FTSO_MANAGER        | 0x8ECF113980b6243de048E081b0E10D613687d5f2 |
| FTSO_REWARD_MANAGER | 0x7ff735F1aDFEE9A99Df4D5D7716C786a2723A723 |
| TELLER              | 0x486C1aD9dBEb33706F77eE44FcD00a6102bFd7d0 |
| TREASURY            | 0x0E1ADb2453900aDe4c4B37cfa60252A13C80859f |
| PRICE_FEED          | 0x32D58E920489BC0c5F8cAa9201AAEDeca0dA575b |
| AUCTIONEER          | 0xf2F03faCba2c86e16E019340100E1b142597276d |
| LINEAR_DECREASE     | 0x2696A92fD81012E61c2e8bb42D564Fe892dBdD93 |
| LIQUIDATOR          | 0xb7351382224B6792BA1eCd1645A2B57a2f8C12Dc |
| RESERVE_POOL        | 0x0CCec782Eb1Ed371720BD0c529aAED66F81B140F |
| MOCK_ERC20_TOKEN    | 0x7B0E124460D7B84E035E65855d72711EE639970F |
| VP_TOKEN            | 0xb6B25400Ca367cF0100CE3155f8ff93bFB2Cfc23 |
| MOCK_VP_TOKEN       | 0x03D124F0f35e17bA5A6BC7C5A0a7A437FE8Fc5Cb |
| SHUTDOWN            | 0x7dCc643421cA6cA32033D92e96272372C5a65c12 |
| LOW_APR             | 0xe1d5D936d9c23de4674a79B3e256789554CFE147 |
| HIGH_APR            | 0x21d16B77860cfF715d6c4b1aCD0aD29da210d97E |
| MOCK_PRICE_FEED     | 0x93aEe9DcD5060cF32C8baA4CcD6341B228CeB730 |
| MOCK_AUCTIONEER     | 0xC4a8904E6859D436b4914f046F69036ca02889E0 |
| MOCK_LIQUIDATOR     | 0x1757C1ce1BC4aC9aE9B102203B06fea1eBB7a129 |
| MOCK_RESERVE        | 0x145589C821d56A71933b515e5fD1e34736ccab13 |

### Coston Network

Coston contract addresses will be listed here.

### Songbird Network

Songbird contract addresses will be listed here.

### Flare Network

Flare contract addresses will be listed here.
