## Deployment

See options for deployment targets below.

### Local Network

If you're deploying to a local Hardhat node, you can use simply do:

```
bash ./init.sh
```

### External Networks

To deploy to other networks, use the `deploy` script. See the example below:

> Tip: Make sure that the account in `hardhat.config.ts` has enough funds for the deployment.

> Tip: If you're using the `flare_local` network, set the `FLARE_DIR` envioronment variable.

> Tip: If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first run `npm run createInitialTx local`, which creates a genesis transaction in order for the network to start properly.

```
NATIVE_TOKEN=<symbol> npm run deploy:<dev|prod> <network>
```

### Exchange Deployment

Since the exchange feature currently uses code from Uniswap, the deployment steps are slightly different. Edit the values in `./scripts/deployUniswap.ts` then run the command below to deploy the exchange contracts.

> Tip: Deploy a new asset with the `deployErc20Token` and `deployNewAsset` scripts if needed

```
yarn run deployUniswap <network>
```

### Post-Deploy

See [administration](./administration.md) for post-deploy steps.
