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

    mapping(bytes32 => Asset) public assetTypes;

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////

    modifier collateralExists(bytes32 assetId) {
        require(address(assetTypes[assetId].ftso) != address(0), "PriceFeed/AssetExists: Asset is not set");
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
        assetTypes[assetId].liquidationRatio = liquidationRatio;
        assetTypes[assetId].ftso = ftso;
    }

    function updateLiquidationRatio(bytes32 assetId, uint256 liquidationRatio) external onlyBy("gov") {
        emit LogVarUpdate(
            "priceFeed",
            assetId,
            "liquidationRatio",
            assetTypes[assetId].liquidationRatio,
            liquidationRatio
        );
        assetTypes[assetId].liquidationRatio = liquidationRatio;
    }

    function updateFtso(bytes32 assetId, FtsoLike newFtso) external onlyBy("gov") {
        emit LogVarUpdate("priceFeed", assetId, "ftso", address(assetTypes[assetId].ftso), address(newFtso));
        assetTypes[assetId].ftso = newFtso;
    }

    function getPrice(bytes32 assetId) public collateralExists(assetId) returns (uint256 price) {
        (price, ) = assetTypes[assetId].ftso.getCurrentPrice();
    }

    // @todo figure out how many places of precision the ftso provides and fix the math accordingly
    function updateAdjustedPrice(bytes32 assetId) external {
        require(address(assetTypes[assetId].ftso) != address(0), "PriceFeed/UpdatePrice: Asset is not initialized");
        (uint256 price, ) = assetTypes[assetId].ftso.getCurrentPrice();
        uint256 adjustedPrice = rdiv(rdiv(price, RAY), assetTypes[assetId].liquidationRatio * 1e9);

        vaultEngine.updateAdjustedPrice(assetId, adjustedPrice);
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////
    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * RAY) + (y / 2)) / y;
    }
}
