// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../../dependencies/Stateful.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

interface VaultEngineLike {
    function modifyStandbyAmount(
        bytes32 assetId,
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
    // Errors
    /////////////////////////////////////////

    error transferFailed();

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
    function deposit() external payable onlyWhen("paused", false) {
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, SafeCast.toInt256(msg.value));
        emit DepositNativeCrypto(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -SafeCast.toInt256(amount));
        if (!payable(msg.sender).send(amount)) revert transferFailed();
        emit WithdrawNativeCrypto(msg.sender, amount);
    }
}
