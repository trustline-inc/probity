# Stablecoin

A stablecoin secured by USD balances

## Quickstart

Make sure the Solidity compiler is installed.

```
$ npm install -g solc
```

```
$ solcjs --version
0.8.0+commit.c7dfd78e.Emscripten.clang
```

Install dependencies:

```
npm install
```

## Deploy on Coston Testnet

Create an `.env` file at the project root with the following contents:

```
PRIVATE_KEY=<INSERT_TESTNET_PK_HERE>
```

```
$ npm run deploy

> @trustline/stablecoin@1.0.0 deploy
> npx hardhat run ./scripts/deploy.ts

SimpleStorage deployed to: 0xB1F59e4B1099F47f6515fa55B909a4502D2bd30D
```