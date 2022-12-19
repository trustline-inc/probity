## Development

### Requirements

- NodeJS
- Yarn

### Recommended IDE

[Visual Studio Code](https://code.visualstudio.com/) is the recommended IDE. Here's how to install Solidity language support:

We recommend installing the [Hardhat + Solidity](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity) IDE extension from the VSCode marketplace.

Also, get the Prettier VSCode plugin:

```
code --install-extension esbenp.prettier-vscode
```

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

**Install Project Dependencies**

Install node dependencies:

```
yarn
```

### Local Development

To start a local network, use `yarn run node`. Alternatively, you can [run a local Flare network](https://gitlab.com/flarenetwork/flare).

Using the `flare_local` network will require you to create an initial transaction first. You can do so like this:

```
npm run createInitialTx <network>
```

### Testing

Use the npm command to run tests on the in-process Hardhat network:

```
npm run test
```

### Publishing

Below are the steps to publish a new version:

1. Update `version` in `package.json` and commit the change

2. Create a tag that matches `version` for the commit and run `git push --follow-tags`

3. [Create a new release](https://github.com/trustline-inc/probity/releases/new) for the tagged version
