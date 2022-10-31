// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.4;

import "../../dependencies/Stateful.sol";

interface VaultEngineLike {
    function modifyStandbyAmount(
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
    // Errors
    /////////////////////////////////////////

    error transferFailed();

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
    function deposit(uint256 amount) external onlyWhen("paused", false) {
        if (!token.transferFrom(msg.sender, address(this), amount)) revert transferFailed();
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, int256(amount));
        emit DepositToken(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        if (!token.transfer(msg.sender, amount)) revert transferFailed();
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -int256(amount));
        emit WithdrawToken(msg.sender, amount, address(token));
    }
}
