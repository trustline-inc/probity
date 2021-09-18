# Probity

[![Build](https://github.com/trustline-inc/aurei/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/aurei/actions/workflows/build.yml)

You can view the contract code in the [`contracts`](./contracts) folder. We will add a full API reference soon. You can find everything else in the [documentation&nbsp;📖 ](https://docs.trustline.co/trustline/-MX0imPEPxcvrbI-teLl/)

## Table of Contents

<!--ts-->
   * [Installation](#installation)
   * [Usage](#usage)
   * [Development](#development)
      * [Installation](#installation)
      * [IDE](#ide)
      * [Testing](#testing)
      * [Publishing](#publishing)
   * [Deployment](#deployment)
      * [Local](#local-deployment)
      * [Remote](#remote-deployment)
   * [Contract Addresses](#contract-addresses)
     * [Coston](#coston-network)
     * [Songbird](#songbird-network)
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
console.log(totalSupply);
```

## Development

### Installation

**1. Solidity Installation**

Make sure the Solidity compiler is installed. The compiler version must be >= `0.8.4`.

To install `solc` run this command:

```
npm install -g solc
```

You can verify the version with like so:

```
solcjs --version
```

**2. Install NPM Modules**

Install node dependencies:

```
npm install
```

**3. Set Environment Variables**

Create an `.env` file with `FLARE_DIR` set to the location of your local Flare directory. Example:

```
FLARE_DIR=/Users/satoshi/Desktop/flare
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

These are the steps for publishing `@trustline/probity` to [npm](https://www.npmjs.com/). The package contains the contract ABIs.

1. Create an `.npmrc` at the project root

> See [authenticating with a personal access token](https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages#authenticating-with-a-personal-access-token) for more info.

```
//npm.pkg.github.com/:_authToken=TOKEN
```

Replace `TOKEN` with your personal access token.

2. Update `version` in `package.json`

3. Run `npm publish`

## Deployment

### Local Deployment

You can deploy in the local network following these steps:

1. Run a local node.

Run a local [Flare](https://gitlab.com/flarenetwork/flare) node.

2. Deploy to the network.

Deploy the smart contract in the local network using `npm run deploy:local`.

> `FLARE_DIR` may be read from a `.env` file or set in the shell

For example:

```
FLARE_DIR=/Users/satoshi/Desktop/flare npm run deploy:local
```

### Remote Deployment

Create an `.env` file at the project root with the following contents:

```
PRIVATE_KEY=<INSERT_TESTNET_PK_HERE>
```

Generate a Flare account and place the private key in the file. Ensure that the account is funded so you can deploy the contract. Then deploy the contract to the remote network using the appropriate script.

```
$ npm run deploy:coston

> @trustline/probity@1.0.0 deploy
> npx hardhat --network coston run ./scripts/deploy.ts
Compiling 1 file with 0.8.0
Compilation finished successfully
Creating Typechain artifacts in directory typechain for target ethers-v5
Successfully generated Typechain artifacts!
Contracts deployed!
```

## Contract Addresses

### Coston Network

Coston contract addresses will be listed here.

### Songbird Network

Songbird contract addresses will be listed here.
