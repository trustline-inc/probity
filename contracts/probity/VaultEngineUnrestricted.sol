// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "./VaultEngine.sol";

/**
 * @title VaultEngineUnrestricted contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 * This contract inherits VaultEngine removes the whitelist feature
 */

contract VaultEngineUnrestricted is VaultEngine {
    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) VaultEngine(registryAddress) {}

    function modifyEquity(
        bytes32 assetId,
        int256 underlyingAmount,
        int256 equityAmount
    ) external override {
        _modifyEquity(assetId, underlyingAmount, equityAmount);
    }

    /**
     * @notice Modifies vault debt
     * @param assetId The ID of the vault asset type
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of systemCurrency to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        int256 collAmount,
        int256 debtAmount
    ) external override {
        _modifyDebt(assetId, collAmount, debtAmount);
    }
}
