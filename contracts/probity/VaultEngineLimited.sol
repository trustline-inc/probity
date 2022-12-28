// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

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
    uint256 private constant RAY = 10 ** 27;

    // For testing on the Songbird network
    uint256 public vaultLimit;

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error vaultLimitReached();

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) VaultEngine(registryAddress) {}

    function modifyEquity(
        bytes32 assetId,
        int256 underlyingAmount,
        int256 equityAmount
    ) external override onlyBy("whitelisted") onlyWhen("paused", false) {
        _modifyEquity(assetId, underlyingAmount, equityAmount);
        _enforceVaultLimit(vaults[assetId][msg.sender]);
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
    ) external override onlyBy("whitelisted") onlyWhen("paused", false) {
        _modifyDebt(assetId, collAmount, debtAmount);
        _enforceVaultLimit(vaults[assetId][msg.sender]);
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
    function _enforceVaultLimit(Vault memory vault) internal view {
        if ((vault.normDebt * debtAccumulator) + vault.initialEquity > vaultLimit) revert vaultLimitReached();
    }
}
