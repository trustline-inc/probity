// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./Dependencies/Base.sol";
import "./Interfaces/IFtso.sol";
import "hardhat/console.sol";

/**
 * @notice Mock contract to store and set FLR/USD prices.
 */
contract Ftso is IFtso {
  // --- Data ---

  uint256 price;

  // --- Constructor ---

  constructor(uint256 _price) {
    price = _price;
  }

  // --- External Functions ---

  function setPrice(uint256 _price) external override {
    price = _price;
    emit PriceUpdated(_price);
  }

  function getPrice() external view override returns (uint256) {
    return price;
  }
}
