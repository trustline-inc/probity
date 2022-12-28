#!/bin/bash

# Setup environment vairbales
export NATIVE_TOKEN=ETH

# (TODO: create separate file other than .env for deploy script output; below conditional is temporary)
if [ -e .env ]
then
    rm .env
fi

# Deploy contracts
yarn run deploy:dev localhost

# Initialize
yarn run initialize localhost

# Get system info
yarn run getSystemInfo localhost

# Create an issuance
yarn run issuance localhost