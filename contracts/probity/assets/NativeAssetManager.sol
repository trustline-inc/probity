// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../../dependencies/Stateful.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/IVaultEngineLike.sol";

contract NativeAssetManager is Stateful, ReentrancyGuard {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    bytes32 public immutable assetId;
    IVaultEngineLike public immutable vaultEngine;

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
        IVaultEngineLike vaultEngineAddress
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

    function withdraw(uint256 amount) external onlyWhen("paused", false) nonReentrant {
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -SafeCast.toInt256(amount));
        Address.sendValue(payable(msg.sender), amount);
        emit WithdrawNativeCrypto(msg.sender, amount);
    }
}
