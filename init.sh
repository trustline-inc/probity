#!/bin/bash

# Setup environment vairbales
# NOTE: Set ETHERNAL_PASSWORD in shell before running script
export ETHERNAL_EMAIL=mrosendin@linqto.com
export ETHERNAL_PASSWORD=HGW_gwt3cgp9vhv4gqp
export NATIVE_TOKEN=ETH

# (TODO: create separate file other than .env for deploy script output; below conditional is temporary)
if [ -e .env ]
then
    rm .env
fi

# Deploy contracts
npm run deploy:dev localhost

# Initialize
yarn run initialize localhost

# Get system info
yarn run getSystemInfo localhost

# Create an issuance
yarn run issuance localhost