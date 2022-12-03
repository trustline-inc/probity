// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../../dependencies/Stateful.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface VaultEngineLike {
    function modifyStandbyAmount(
        bytes32 collateral,
        address user,
        int256 amount
    ) external;
}

contract ERC20AssetManager is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    VaultEngineLike public immutable vaultEngine;
    IERC20 public immutable token;
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
        IERC20 asset,
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
        SafeERC20.safeTransferFrom(token, msg.sender, address(this), amount);
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, int256(amount));
        emit DepositToken(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        SafeERC20.safeTransfer(token, msg.sender, amount);
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -int256(amount));
        emit WithdrawToken(msg.sender, amount, address(token));
    }
}
