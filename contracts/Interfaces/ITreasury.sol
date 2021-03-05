// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages a treasury of Aurei.
 */
interface ITreasury {

  // --- Events ---

  event TreasuryIncrease(address owner, uint amount);
  event TreasuryDecrease(address owner, uint amount);

  // --- Functions ---

  function balanceOf(address owner) external view returns (uint256);

  function increase(uint256 amount, address owner) external;

  function decrease(uint256 amount, address owner) external;

  function transfer(address borrower, uint amount) external;

  function transferEquity(address lender, address borrower, uint amount) external;
}
