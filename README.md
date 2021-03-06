# Probity

Smart contract system for the Aurei crypto stablecoin

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

## Upgrades

Required reading: [The State of Smart Contract Upgrades](https://blog.openzeppelin.com/the-state-of-smart-contract-upgrades/)

[Use the same patterns as Dharma Smart Wallet](https://github.com/dharma-eng/dharma-smart-wallet).

### Upgrade Governance

For development, we will use EOAs (externally-owned accounts) as contract owners. For mainnet upgrades, we will adopt a voting process similar to MakerDAO and Compound.

## System Design

### Solvency Condition

We modify the Accounting Equation definition of `Assets - Liabilities = Equity` to formulate a solvency inequality.

```
RESERVES + LOANS + YIELD - DEBT - INTEREST <= COLLATERAL_PRICE * COLLATERAL / MIN_COLLATERAL_RATIO
```

The value of the collateral must maintain a ratio w.r.t. the stablecoin and must be greater than the left-hand side to remain solvent.

Take the following variables at time `t = 0`:

**Right-hand side**

| COLLATERAL | COLLATERAL_PRICE | MIN_COLLATERAL_RATIO |
| ---------- | ---------------- | -------------------- |
| 15,000,000 | $1               | 150%                 |

**Left-hand side**

| RESERVES   | LOANS      | YIELD | DEBT        | INTEREST |
| ---------- | ---------- | ----- | ----------- | -------- |
| $1,000,000 | $9,000,000 | 0     | $9,000,0000 | 0        |

This gives us the starting inequality:

```
$1,000,000 + $9,000,000 + 0 - $9,000,000 - 0 <= $10,000,000
```

This system is solvent but unhealthy, because if the collateral price drops, the system will be insolvent. If the price drops, collateral (equity on the balance sheet) is liquidated and sold for Aurei to pay off debt, reducing the left-hand side, and maintaining the solvency condition.
