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

You can publish the `@trustline/aurei` npm package containing the contract ABIs using this command:

```
npm publish
```

## Deployment

### Local Deployment

You can deploy in the local network following these steps:

1. Run a local node.

You can run a local Flare node by using the `local.sh` script in in [`flare`](https://gitlab.com/flarenetwork/flare).

2. Deploy to the network.

Open a new terminal and deploy the smart contract in the local network

```
npm run deploy:local
```

### Deploy on Coston Testnet

Create an `.env` file at the project root with the following contents:

```
PRIVATE_KEY=<INSERT_TESTNET_PK_HERE>
```

Generate an Ethereum account and place the private key in the file. Ensure that the account is funded so you can deploy the contract.

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

| Contract | Address                                    |
| -------- | ------------------------------------------ |
| Aurei    | 0xCF089F2dDEa08213be33f8dd05787D568cA6E61d |
| Registry | 0xcb285Ce3871AA7BDaf8991cA8E72332fda683cE8 |
| Teller   | 0x3AE45E2cb7839aE239f14401894780A151Ebe617 |
| Treasury | 0x00316Cc40E7D92b81C7b89777100159B13F128B9 |
| Vault    | 0x3dA42377eee416d59389eb0dcEAE01Ad9eA0dc10 |

## Publishing

[Authenticating with a personal access token](https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages#authenticating-with-a-personal-access-token)

1. Create an `.npmrc` at the project root

```
//npm.pkg.github.com/:_authToken=TOKEN
```

2. Update `version` in `package.json`

3. Run `npm publish`

## Upgrades

Required reading: [The State of Smart Contract Upgrades](https://blog.openzeppelin.com/the-state-of-smart-contract-upgrades/)

[Use the same patterns as Dharma Smart Wallet](https://github.com/dharma-eng/dharma-smart-wallet).

### Upgrade Governance

For development, we will use EOAs (externally-owned accounts) as contract owners. For mainnet upgrades, we will adopt a voting process similar to MakerDAO and Compound.
