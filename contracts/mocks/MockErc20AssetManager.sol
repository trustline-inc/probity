// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface TokenLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

interface VaultEngineLike {
    function modifyStandbyAsset(
        bytes32 collateral,
        address user,
        int256 amount
    ) external;
}

contract MockErc20AssetManager {
    constructor(
        bytes32 id,
        TokenLike asset,
        VaultEngineLike vaultEngineAddress
    ) {
        assetId = id;
        vaultEngine = vaultEngineAddress;
        token = asset;
    }

    TokenLike public immutable token;
    bytes32 public immutable assetId;
    VaultEngineLike public immutable vaultEngine;

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "ERC20AssetManager/deposit: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, int256(amount));
    }

    function withdraw(uint256 amount) external {
        require(token.transfer(msg.sender, amount), "ERC20AssetManager/withdraw: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, -int256(amount));
    }
}
