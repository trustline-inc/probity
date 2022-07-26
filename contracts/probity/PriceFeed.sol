// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";

interface VaultEngineLike {
    function updateAdjustedPrice(bytes32 assetId, uint256 price) external;
}

interface FtsoLike {
    function getCurrentPrice() external returns (uint256 _price, uint256 _timestamp);
}

/**
 * @title PriceFeed contract
 * @notice The connector between FTSO and probity making sure the price is in the correct format probity requires and
 *          updates the vaultEngine with price.
 */
contract PriceFeed is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////
    struct Asset {
        uint256 liquidationRatio; // [WAD]
        FtsoLike ftso;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 1e27;
    VaultEngineLike public immutable vaultEngine;

    mapping(bytes32 => Asset) public assets;

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////
    modifier collateralExists(bytes32 assetId) {
        require(address(assets[assetId].ftso) != address(0), "PriceFeed/AssetExists: Asset is not set");
        _;
    }

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address registryAddress, VaultEngineLike vaultEngineAddress) Stateful(registryAddress) {
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
        FtsoLike ftso
    ) external onlyBy("gov") {
        require(
            address(assets[assetId].ftso) == address(0),
            "PriceFeed/initAsset: This asset has already been initialized"
        );
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
        emit LogVarUpdate("priceFeed", assetId, "liquidationRatio", assets[assetId].liquidationRatio, liquidationRatio);
        assets[assetId].liquidationRatio = liquidationRatio;
    }

    /**
     * @notice Updates the FTSO address of this price feed.
     * @param assetId The ID of the asset to update
     * @param newFtso The address of the new FTSO
     */
    function updateFtso(bytes32 assetId, FtsoLike newFtso) external onlyBy("gov") {
        emit LogVarUpdate("priceFeed", assetId, "ftso", address(assets[assetId].ftso), address(newFtso));
        assets[assetId].ftso = newFtso;
    }

    /**
     * @notice Gets the current price of the given asset.
     * @param assetId The ID of the asset to get the price for
     */
    function getPrice(bytes32 assetId) public collateralExists(assetId) returns (uint256 price) {
        (price, ) = assets[assetId].ftso.getCurrentPrice();
        price = Math._rdiv(price, 1e5);
    }

    /**
     * @notice Update the adjusted price used in VaultEngine
     * @dev The FTSO has a price precision of 5
     * @param assetId The ID of the asset to to update
     */
    function updateAdjustedPrice(bytes32 assetId) external {
        require(address(assets[assetId].ftso) != address(0), "PriceFeed/UpdatePrice: Asset is not initialized");
        uint256 price = this.getPrice(assetId);
        uint256 adjustedPrice = Math._rdiv(price, assets[assetId].liquidationRatio * 1e9);
        vaultEngine.updateAdjustedPrice(assetId, adjustedPrice);
    }
}
