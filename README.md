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
$ npm run deploy:coston

> @trustline/aurei@0.1.0 deploy
> npx hardhat --network coston run ./scripts/deploy.ts
Compiling 1 file with 0.8.0
Compilation finished successfully
Creating Typechain artifacts in directory typechain for target ethers-v5
Successfully generated Typechain artifacts!
Contracts deployed!
```

#### Testnet Contracts

|Contract|Address                                   |
|--------|------------------------------------------|
|aurei   |0x55195Bb903Bf8e8c40a96Af4acCd5B64C1E616dA|
|registry|0xC36d2dd30605Aff0cd972e9a9F5C8F78D007bCd2|
|teller  |0xD0c8A3321bAA4828aE7d8d7f956748AD5E816701|
|treasury|0x11BcB77D52198920E968D19529593C5C41Df7A64|
|vault   |0xd73C83B46d16A4069344eAF148F214C4A0BbAd36|

## Upgrades

Required reading: [The State of Smart Contract Upgrades](https://blog.openzeppelin.com/the-state-of-smart-contract-upgrades/)

[Use the same patterns as Dharma Smart Wallet](https://github.com/dharma-eng/dharma-smart-wallet).

### Upgrade Governance

For development, we will use EOAs (externally-owned accounts) as contract owners. For mainnet upgrades, we will adopt a voting process similar to MakerDAO and Compound.
