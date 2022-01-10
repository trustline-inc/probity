// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";

interface TreasuryLike {
    function depositStablecoin(uint256 amount) external;

    function withdrawStablecoin(uint256 amount) external;
}

interface VaultEngineLike {
    function modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) external;
}

contract VaultManager is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////

    TreasuryLike public immutable treasury;
    VaultEngineLike public immutable vaultEngine;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event Borrow(address indexed user, bytes32 assetId, uint256 amount, uint256 collAmount);
    event Repay(address indexed user, bytes32 assetId, uint256 amount, uint256 collAmount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        TreasuryLike treasuryAddress,
        VaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        treasury = treasuryAddress;
        vaultEngine = vaultEngineAddress;
    }

    /**
     * @notice Create a loan
     * @param assetId The ID of the collateral asset
     * @param amount The amount of the loan
     * @param collAmount The amount of collateral
     */
    function borrow(
        bytes32 assetId,
        uint256 amount,
        uint256 collAmount
    ) external {
        vaultEngine.modifyDebt(assetId, address(treasury), int256(collAmount), int256(amount));
        treasury.withdrawStablecoin(amount);
        emit Borrow(msg.sender, assetId, amount, collAmount);
    }

    /**
     * @notice Repay a loan
     * @param assetId The ID of the collateral asset
     * @param amount The amount of the loan
     * @param collAmount The amount of collateral
     */
    function repay(
        bytes32 assetId,
        uint256 amount,
        uint256 collAmount
    ) external {
        treasury.depositStablecoin(amount);
        vaultEngine.modifyDebt(assetId, address(treasury), int256(collAmount), int256(amount));
        emit Repay(msg.sender, assetId, amount, collAmount);
    }
}
