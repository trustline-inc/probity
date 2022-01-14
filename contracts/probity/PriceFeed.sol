// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function updateAdjustedPrice(bytes32 assetId, uint256 price) external;
}

interface FtsoLike {
    function getCurrentPrice() external returns (uint256 _price, uint256 _timestamp);
}

contract PriceFeed is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////
    struct Asset {
        uint256 liquidationRatio;
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
    function init(
        bytes32 assetId,
        uint256 liquidationRatio,
        FtsoLike ftso
    ) external onlyBy("gov") {
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
    }

    /**
     * @notice Update the adjusted price used in VaultEngine
     * @param assetId The ID of the asset to to update
     * TODO figure out how many places of precision the ftso provides and fix the math accordingly
     */
    function updateAdjustedPrice(bytes32 assetId) external {
        require(address(assets[assetId].ftso) != address(0), "PriceFeed/UpdatePrice: Asset is not initialized");
        (uint256 price, ) = assets[assetId].ftso.getCurrentPrice();
        uint256 adjustedPrice = rdiv(rdiv(price, RAY), assets[assetId].liquidationRatio * 1e9);

        vaultEngine.updateAdjustedPrice(assetId, adjustedPrice);
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////
    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * RAY) + (y / 2)) / y;
    }
}
