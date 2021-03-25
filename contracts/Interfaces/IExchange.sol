// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchange {
  // --- Events ---

  // --- Functions ---

  function executeOrder(uint256 collateral, uint256 principal) external;
}
