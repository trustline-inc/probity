// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MockFtso {
    uint256 public price;
    uint256 public lastUpdated;

    constructor() {
        price = 1e5;
        lastUpdated = block.timestamp;
    }

    function setCurrentPrice(uint256 _price) external {
        price = _price;
        lastUpdated = block.timestamp;
    }

    function getCurrentPrice() external view returns (uint256 _price, uint256 _timestamp) {
        return (price, lastUpdated);
    }
}
