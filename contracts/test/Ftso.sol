// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Ftso {
  uint256 price;
  uint256 lastUpdated;

  constructor() {
    price = 1e27;
    lastUpdated = block.timestamp;
  }

  function setCurrentPrice(uint256 _price) external {
    price = _price;
    lastUpdated = block.timestamp;
  }

  function getCurrentPrice()
    external
    view
    returns (uint256 _price, uint256 _timestamp)
  {
    return (price, lastUpdated);
  }
}
