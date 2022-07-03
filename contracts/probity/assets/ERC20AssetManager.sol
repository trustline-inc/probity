// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../dependencies/Stateful.sol";

interface VaultEngineLike {
    function modifyStandbyAsset(
        bytes32 collateral,
        address user,
        int256 amount
    ) external;
}

interface TokenLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

contract ERC20AssetManager is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    VaultEngineLike public immutable vaultEngine;
    TokenLike public immutable token;
    bytes32 public immutable assetId;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event DepositToken(address indexed user, uint256 amount, address indexed token);
    event WithdrawToken(address indexed user, uint256 amount, address indexed token);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        bytes32 id,
        TokenLike asset,
        VaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        assetId = id;
        vaultEngine = vaultEngineAddress;
        token = asset;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////
    function deposit(uint256 amount) external onlyWhen("paused", false) onlyBy("whitelisted") {
        require(token.transferFrom(msg.sender, address(this), amount), "ERC20AssetManager/deposit: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, int256(amount));
        emit DepositToken(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        require(token.transfer(msg.sender, amount), "ERC20AssetManager/withdraw: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, -int256(amount));
        emit WithdrawToken(msg.sender, amount, address(token));
    }
}
