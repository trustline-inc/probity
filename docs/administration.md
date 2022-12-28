# Administration

## Initialization

You can use a script to initialize the system with a new asset type.

> Override the native token on the `local` or `internal` networks with `NATIVE_TOKEN=<SGB|FLR|XRP|ETH>`.

```
NATIVE_TOKEN=<symbol> yarn run initialize <network>
```

## Utilities

### System Info

Use this command to paste the output into [trustline-inc/probity-ui](https://github.com/trustline-inc/probity-ui):

```
yarn run getSystemInfo <network>
```

### Fiat Tokens

The system admin (also referred to as the "governance address") is able to issue fiat tokens for lending in Probity when using `VaultEngineIssuer`.

```
yarn run issuance <network>
```

### Rate Updater

Run this command to update the debt and equity rate accumulators every 5 seconds.

> Note: You must first commit funds to the lending pool, otherwise you will get an execution error.

```
yarn run rateUpdater <network>
```

### Price Updater

Run this command in the local environment to use the mock FTSO.

```
yarn run priceUpdater <network>
```

### Allow Address

Edit `./scripts/whitelistAddress.ts` to update the new allowed address, then run this:

```
yarn run whitelistAddress <network>
```
