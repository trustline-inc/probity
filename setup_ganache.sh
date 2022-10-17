echo "Setting up Ganache network"

NATIVE_TOKEN=ETH npx hardhat run ./scripts/deploy.ts --network ganache
NATIVE_TOKEN=ETH yarn run initialize ganache
yarn run getSystemInfo ganache

# TODO: use sed with pbpaste output on probity-ui config file
pbpaste
