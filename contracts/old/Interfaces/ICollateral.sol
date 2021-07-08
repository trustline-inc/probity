// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages the price of collateral assets.
 */
interface ICollateral {
  // --- Functions ---
  function deposit(uint256 amount) external payable;

  function withdraw(uint256 amount) external;
}
