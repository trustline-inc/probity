// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "hardhat/console.sol";

/**
 * @notice Mock contract to store and set FLR/USD prices.
 */
contract Ftso {
  // --- Events ---

  event PriceUpdated(uint256 _price);

  // --- Data ---

  uint256 price;

  // --- Constructor ---

  constructor() {}

  // --- External Functions ---

  function setPrice(uint256 _price) external {
    price = _price;
    emit PriceUpdated(_price);
  }

  function getPrice() external view returns (uint256) {
    return price;
  }
}
