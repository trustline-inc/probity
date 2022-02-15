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
  - [Rate Updater](#rate-updater)
  - [Price Updater](#price-updater)
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

You can use a script to initialize the system with a new asset type.

```
FLARE_DIR=~/Desktop/flare \
yarn run initialize:songbird
```

You can override the native token in the `local` or `internal` networks with `NATIVE_TOKEN=<CFLR|SGB|FLR>`.

## Utility Scripts

### Rate Updater

Run this command to call `Teller.updateAccumulators()` every 5 seconds.

```
yarn run rateUpdater:<network>
```

### Price Updater

Run this command in the local environment to use the mock FTSO.

```
yarn run priceUpdater:local
```

## Contract Addresses

### Internal Network

The internal network is only accessible to the Probity developers. The network native token depends on the chain ID. Since we're running chain ID 16, the native token is `CFLR` and the stablecoin is `AUR`.

| Contract            | Address                                    |
| ------------------- | ------------------------------------------ |
| AUREI               | 0xCB0A71445F2791740054ED2208182512AbbdD795 |
| BOND_ISSUER         | 0xdca77A48c628a50516a9cBeaB4F37c389956a1eb |
| FTSO                | 0xb446EA59ac7bbf0eFcab8629f087C19E8e011601 |
| REGISTRY            | 0x03eA808a61c4b2000d0f17552bCc37F49c3A82ca |
| PBT_TOKEN           | 0x5F9710c8A313E64251359b042791749830E41E4a |
| VAULT_ENGINE        | 0x1541b3C9b6285716Be6dc152aE4dfd9940cf99A4 |
| NATIVE_TOKEN        | 0xc62B7C8FA1D0634f45c0dB07ea123ccF3D3907E6 |
| ERC20_TOKEN         | 0x2F10D1133369D7390b8b8cac721Ef63f86330D6e |
| FTSO_MANAGER        | 0x9E4357cAF8952cA0ad9e1F770120a3f02857D942 |
| FTSO_REWARD_MANAGER | 0x16f905a8F3E84D18980406eF06008f8E0BF188eb |
| TELLER              | 0xc9fbEce4d6B1C66B421c3D4ba7aa72ABee0f42E0 |
| TREASURY            | 0x89341798f5B2CC687D721BAe1B26210e4d5eB4cA |
| PRICE_FEED          | 0xD8EFDec425c9b1d7D6F0710348286677E3eeeF79 |
| AUCTIONEER          | 0x075510e438149EFceD44751ae56c8434BbC7fD9e |
| LINEAR_DECREASE     | 0x5E8DB7A9a2Bf7e33fdb7dB8cd6F53BaEDde20f45 |
| LIQUIDATOR          | 0x21439178E443dF761f971D658618e55a31Fb76dE |
| RESERVE_POOL        | 0x00590d131740D1Bfcdfca4a174e6bB1c78C5feA3 |
| MOCK_ERC20_TOKEN    | 0x9FF5DEbFA4872b37f2e1cfac5ad87766337F5E0d |
| VP_TOKEN            | 0xf75c87C3Bf0c8f4C0a798E30D7B664c1E0855a97 |
| MOCK_VP_TOKEN       | 0xF452fcA2c0232e5326C449647BBA40292AA0D60A |
| SHUTDOWN            | 0x4C044df4613C5b92ee64e859Da165A8c52269Cc7 |
| LOW_APR             | 0x80685Aa8a6029cff21973842EBa35c8E16d429a1 |
| HIGH_APR            | 0x848D05D7C2BBb7616c0Fa3d5834931B8b300B224 |
| MOCK_PRICE_FEED     | 0xAd83B773175244D1C841e9d0e1FD02907dA4F8a0 |
| MOCK_AUCTIONEER     | 0xd58f5e8fEb5992B4f138e6C0DB2EbBB0Ed162b93 |
| MOCK_LIQUIDATOR     | 0xEd1e71855c8cC11E5d9aeF1BD7ecC31df0B63261 |
| MOCK_RESERVE        | 0x7F8ADFB2a8a0F393c32b0DEe215F707454E03913 |
| MOCK_BOND_ISSUER    | 0xbd6F1834458C55D9FDa43a2987910A39eF8C7565 |

### Coston Network

The network native token is `CFLR` and the stablecoin is `AUR`.

| Contract            | Address                                    |
| ------------------- | ------------------------------------------ |
| AUREI               | 0x79b93027696D10e2872539730B0CF56171ae1f1c |
| BOND_ISSUER         | 0xfa8Ae8Cf39902CF8953D0593a96B4b891C210474 |
| FTSO                | 0x6F3BCe778eDaa78DF55e32fAe68F2f3E2cd96bE8 |
| REGISTRY            | 0xAaEd2f90a243B336f222c02f52C364c56a9ddff2 |
| PBT_TOKEN           | 0xb14f4Eee7957BD63C89abCcBea25f985c804bd2f |
| VAULT_ENGINE        | 0x96EEC6D0BCeb601d68fEa183f6D57896aD250565 |
| NATIVE_TOKEN        | 0x50D59bd26b352924Bd8a29A28aa00f1878EbBDB7 |
| ERC20_TOKEN         | 0x98E6cBCf1316778703ecF329DdD8C8d237CDa10f |
| FTSO_MANAGER        | 0x652954207A71d49B1507dBd4F4c81b6Bfbbc92cA |
| FTSO_REWARD_MANAGER | 0x8FB5598d586ef225e1568110eDBA08d609C682D4 |
| TELLER              | 0x3D9DD7877B8753D718f42bf029511CcE9077d1EC |
| TREASURY            | 0xa9Fd6b0d2aa2bfAf1454CE3970eaA0E87B3A931C |
| PRICE_FEED          | 0x3Fabfa32708C7b43e204370472f664F1E8545AE8 |
| AUCTIONEER          | 0xccbB706805D534De6C1278BdEC3Ef99F7b0BF69E |
| LINEAR_DECREASE     | 0xf0Bd3808E60a00060F004FFEa6B45fe6d4337BE0 |
| LIQUIDATOR          | 0xDD86bB351ED4108c8AA58A2D1Ee992509567a178 |
| RESERVE_POOL        | 0xdc335b02849D4830dE34dbC77FE1D5861C499450 |
| MOCK_ERC20_TOKEN    | 0x24893537De80C774f3566a8D83c256c791998407 |
| VP_TOKEN            | 0x0c18581cD198c118473aBaB7807CAb7b3Ccdd1F5 |
| MOCK_VP_TOKEN       | 0x6076c6652597E9fBC89D30FCf543a8b0f9e3d0FB |
| SHUTDOWN            | 0x3417b7C95D4865d16fa96aC1e9d8da4779989E4F |
| LOW_APR             | 0xBfe458053E97735cc98B3710F92A622467A457FD |
| HIGH_APR            | 0x67D874A051d8c01eCfbd5c4F691959405e017d42 |
| MOCK_PRICE_FEED     | 0xbfF9645C2861593E7EcDfD541de04b17645468a5 |
| MOCK_AUCTIONEER     | 0x1A3DfFb63bA6bCC79abd38C580fC0E58c36259aa |
| MOCK_LIQUIDATOR     | 0x4CfEf7b876bE9b8Bb187d616f988219a34bC9e4F |
| MOCK_RESERVE        | 0x607A2b6C0D00341aB3d9CBFa5F0AaD6c552662BF |
| MOCK_BOND_ISSUER    | 0x37516F0cd21F16814330D7DbEb19D1cef105aFcE |

### Songbird Network

Songbird contract addresses will be listed here.

### Flare Network

Flare contract addresses will be listed here.
