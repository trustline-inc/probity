// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../interfaces/IFtsoLike.sol";

contract MockPriceFeed {
    struct Asset {
        uint256 liquidationRatio;
        IFtsoLike ftso;
        uint256 price;
    }

    uint256 private constant RAY = 1e27;

    mapping(bytes32 => bool) public states;
    mapping(bytes32 => Asset) public assets;

    function getPrice(bytes32 assetId) public view returns (uint256 price) {
        return assets[assetId].price;
    }

    function setPrice(bytes32 assetId, uint256 newPrice) external {
        assets[assetId].price = newPrice;
    }
}
