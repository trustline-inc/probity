## Deployment

If you're deploying to a local Hardhat node, you can use simply do:

```
bash ./init.sh
```

To deploy to other networks, use the `deploy` script. Make sure that the account in `hardhat.config.ts` has enough funds for the deployment.

> If you're using the `flare_local` network, set the `FLARE_DIR` envioronment variable.

For example:

```
NATIVE_TOKEN=<symbol> npm run deploy:<dev|prod> <network>
```

If you get the error `ProviderError: err: Invalid value for block.coinbase`, that means you have to first run `npm run createInitialTx local`, which creates a genesis transaction in order for the network to start properly.
