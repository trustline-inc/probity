// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";
import "../interfaces/IVaultEngineLike.sol";
import "../interfaces/IFtsoLike.sol";
import "../interfaces/IPriceFeedLike.sol";

/**
 * @title PriceFeed contract
 * @notice The connector between FTSO and probity making sure the price is in the correct format probity requires and
 *          updates the vaultEngine with price.
 */
contract PriceFeed is Stateful, Eventful, IPriceFeedLike {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////
    struct Asset {
        uint256 liquidationRatio; // [WAD]
        IFtsoLike ftso;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 1e27;
    uint256 private constant WAD = 1e18;
    IVaultEngineLike public immutable vaultEngine;

    mapping(bytes32 => Asset) public assets;

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error assetNotInitialized();
    error assetAlreadyInitialized();
    error valueProvidedIsAboveUpperBounds();
    error valueProvidedIsBelowLowerBounds();

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////
    modifier collateralExists(bytes32 assetId) {
        if (address(assets[assetId].ftso) == address(0)) revert assetNotInitialized();
        _;
    }

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address registryAddress, IVaultEngineLike vaultEngineAddress) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////
    /**
     * @dev initialize a new asset and set the liquidation ratio and ftso addresss
     * @param assetId the asset ID
     * @param liquidationRatio liquidationRatio for the asset
     * @param ftso the ftso address for the asset
     */
    function initAsset(
        bytes32 assetId,
        uint256 liquidationRatio,
        IFtsoLike ftso
    ) external onlyBy("gov") {
        if (address(assets[assetId].ftso) != address(0)) revert assetAlreadyInitialized();

        assets[assetId].liquidationRatio = liquidationRatio;
        assets[assetId].ftso = ftso;
    }

    /**
     * @notice Updates the given asset's liquidation ratio.
     * @dev Only callable by governance.
     * @param assetId The ID of the asset to update
     * @param liquidationRatio The new ratio
     */
    function updateLiquidationRatio(bytes32 assetId, uint256 liquidationRatio) external onlyBy("gov") {
        if (liquidationRatio < WAD) revert valueProvidedIsBelowLowerBounds();
        if (liquidationRatio > WAD * 10) revert valueProvidedIsAboveUpperBounds();
        emit LogVarUpdate("priceFeed", assetId, "liquidationRatio", assets[assetId].liquidationRatio, liquidationRatio);
        assets[assetId].liquidationRatio = liquidationRatio;
    }

    /**
     * @notice Updates the FTSO address of this price feed.
     * @param assetId The ID of the asset to update
     * @param newFtso The address of the new FTSO
     */
    function updateFtso(bytes32 assetId, IFtsoLike newFtso) external onlyBy("gov") {
        emit LogVarUpdate("priceFeed", assetId, "ftso", address(assets[assetId].ftso), address(newFtso));
        assets[assetId].ftso = newFtso;
    }

    /**
     * @notice Gets the current price of the given asset.
     * @param assetId The ID of the asset to get the price for
     */
    function getPrice(bytes32 assetId) public override collateralExists(assetId) returns (uint256 price) {
        (price, ) = assets[assetId].ftso.getCurrentPrice();
        price = Math._rdiv(price, 1e5);
    }

    /**
     * @notice Update the adjusted price used in VaultEngine
     * @dev The FTSO has a price precision of 5
     * @param assetId The ID of the asset to to update
     */
    function updateAdjustedPrice(bytes32 assetId) external collateralExists(assetId) onlyWhen("paused", false) {
        uint256 price = this.getPrice(assetId);
        uint256 adjustedPrice = Math._rdiv(price, assets[assetId].liquidationRatio * 1e9);
        vaultEngine.updateAdjustedPrice(assetId, adjustedPrice);
    }
}
