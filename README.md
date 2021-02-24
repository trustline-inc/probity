# Stablecoin

Aurei crypto stablecoin

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

## Testing

Use the npm command to run tests on the local Hardhat network:

```
npm run test
```

## Deploy on Coston Testnet

Create an `.env` file at the project root with the following contents:

```
PRIVATE_KEY=<INSERT_TESTNET_PK_HERE>
```

Generate an Ethereum account and place the private key in the file. Request for your testnet account funded with `FLR` so you can deploy the contract.

```
$ npm run deploy

> @trustline/stablecoin@1.0.0 deploy
> npx hardhat run ./scripts/deploy.ts

SimpleStorage deployed to: 0xB1F59e4B1099F47f6515fa55B909a4502D2bd30D
```