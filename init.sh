#!/bin/bash

# Setup environment vairbales
# NOTE: Set ETHERNAL_PASSWORD in shell before running script
export ETHERNAL_EMAIL=mrosendin@linqto.com
export ETHERNAL_PASSWORD=***REMOVED***
export NATIVE_TOKEN=ETH

# (TODO: create separate file other than .env for deploy script output; below conditional is temporary)
if [ -e .env ]
then
    rm .env
fi

# Deploy contracts
npm run deploy:dev hardhat

# Initialize
yarn run initialize hardhat

# Get system info
yarn run getSystemInfo hardhat
