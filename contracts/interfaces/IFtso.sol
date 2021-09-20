// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Base.sol";

/**
 * @notice Manages the price of collateral assets.
 */
interface IFtso {
  // --- Events ---

  event PriceUpdated(uint256 _price);

  // --- Functions ---

  function setPrice(uint256 _price) external;

  function getPrice() external view returns (uint256);
}
