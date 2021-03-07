// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchange {
  // --- Events ---

  // --- Functions ---

  function executeOrder(
    address lender,
    address borrower,
    uint256 amount,
    uint256 rate
  ) external;
}
