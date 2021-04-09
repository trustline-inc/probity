# Aurei Stablecoin

[![Build](https://github.com/trustline-inc/aurei/actions/workflows/build.yml/badge.svg)](https://github.com/trustline-inc/aurei/actions/workflows/build.yml)

Smart contract system for the Aurei crypto stablecoin.

You can view the documentation [here](https://docs.trustline.co/trustline/-MX0imPEPxcvrbI-teLl/).

## Quickstart

Install Node.js. The recommended way to install Node with macOS is with [Homebrew](https://nodejs.org/en/download/package-manager/#macos).

Make sure the Solidity compiler is installed.

```
$ npm install -g solc
```

The compiler version must be >= `0.8.0`.

```
$ solcjs --version
0.8.0+commit.c7dfd78e.Emscripten.clang
```

Install dependencies:

```
npm install
```

## IDE

[Visual Studio Code](https://code.visualstudio.com/) is the recommended IDE. Here's how to install Solidity language support:

```
code --install-extension JuanBlanco.solidity
```

Also, get the Prettier VSCode plugin:

```
code --install-extension esbenp.prettier-vscode
```

## Testing

Use the npm command to run tests on the local Hardhat network:

```
npm run test
```

## Publishing

You can publish the `@trustline/probity` npm package containing the contract ABIs using this command:

```
npm publish
```

## Deployment

### Local Deployment

You can deploy in the localhost network following these steps:

Start a local node

```
npm run node
```

Open a new terminal and deploy the smart contract in the localhost network

```
npm run deploy:local
```

### Deploy on Coston Testnet

Create an `.env` file at the project root with the following contents:

```
PRIVATE_KEY=<INSERT_TESTNET_PK_HERE>
```

Generate an Ethereum account and place the private key in the file. Request for your testnet account funded with `FLR` so you can deploy the contract.

```
$ npm run deploy:prod

> @trustline/stablecoin@1.0.0 deploy
> npx hardhat run ./scripts/deploy.ts

SimpleStorage deployed to: 0xB1F59e4B1099F47f6515fa55B909a4502D2bd30D
```

## Upgrades

Required reading: [The State of Smart Contract Upgrades](https://blog.openzeppelin.com/the-state-of-smart-contract-upgrades/)

[Use the same patterns as Dharma Smart Wallet](https://github.com/dharma-eng/dharma-smart-wallet).

### Upgrade Governance

For development, we will use EOAs (externally-owned accounts) as contract owners. For mainnet upgrades, we will adopt a voting process similar to MakerDAO and Compound.
