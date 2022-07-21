// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../../dependencies/Stateful.sol";

interface VaultEngineLike {
    function modifyStandbyAsset(
        bytes32 collateral,
        address user,
        int256 amount
    ) external;
}

contract NativeAssetManager is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    bytes32 public immutable assetId;
    VaultEngineLike public immutable vaultEngine;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event DepositNativeCrypto(address indexed user, uint256 amount);
    event WithdrawNativeCrypto(address indexed user, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        bytes32 id,
        VaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        assetId = id;
        vaultEngine = vaultEngineAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////
    function deposit() external payable onlyWhen("paused", false) onlyBy("whitelisted") {
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, int256(msg.value));
        emit DepositNativeCrypto(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, -int256(amount));
        require(payable(msg.sender).send(amount), "NativeAssetManager/withdraw: fail to send FLR");
        emit WithdrawNativeCrypto(msg.sender, amount);
    }
}
