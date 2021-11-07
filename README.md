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
- [Contract Addresses](#contract-addresses)
  - [Coston](#coston-network)
  - [Songbird](#songbird-network)
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

2. Deploy to the network.

Deploy the smart contract in the local network using the `deploy:local` script.

> Set the `FLARE_DIR` and `TOKEN` envioronment variables.

For example:

```
FLARE_DIR=~/Desktop/flare \
TOKEN=phi \
npm run deploy:local
```

If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first send a test transaction through Metamask in order for the network to start properly.

## Initialization

You can use the `initialize` script to configure a fresh deployment of the Probity system.

The script currently only initializes a `FLR` collateral type.

```
FLARE_DIR=~/Desktop/flare yarn run initialize
```

## Contract Addresses

### Coston Network

Coston contract addresses will be listed here.

### Songbird Network

Songbird contract addresses will be listed here.

### Flare Network

Flare contract addresses will be listed here.
