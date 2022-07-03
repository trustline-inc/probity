// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./VaultEngine.sol";

/**
 * @title VaultEngineLimited contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 * This contract inherits VaultEngine and adds a feature to limit the vault size
 */

contract VaultEngineLimited is VaultEngine {
    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    // For testing on the Songbird network
    uint256 public vaultLimit;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) VaultEngine(registryAddress) {}

    function modifyEquity(
        bytes32 assetId,
        address treasuryAddress,
        int256 underlyingAmount,
        int256 equityAmount
    ) external override onlyBy("whitelisted") {
        _modifyEquity(assetId, treasuryAddress, underlyingAmount, equityAmount);
        enforceVaultLimit(assetId, vaults[assetId][msg.sender]);
    }

    /**
     * @notice Modifies vault debt
     * @param assetId The ID of the vault asset type
     * @param treasuryAddress The address of the desired treasury contract
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of stablecoin to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) external override onlyBy("whitelisted") {
        _modifyDebt(assetId, treasuryAddress, collAmount, debtAmount);
        enforceVaultLimit(assetId, vaults[assetId][msg.sender]);
    }

    /**
     * @notice Updates individual vault limit
     */
    function updateIndividualVaultLimit(uint256 newLimit) external onlyBy("gov") {
        vaultLimit = newLimit;
    }

    /**
     * @notice Check if user's vault is under vault limit
     */
    function enforceVaultLimit(bytes32 assetId, Vault memory vault) internal view {
        require(
            (vault.debt * assets[assetId].debtAccumulator) + vault.initialEquity <= vaultLimit,
            "Vault is over the individual vault limit"
        );
    }
}
