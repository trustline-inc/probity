// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages debts for all vaults.
 */
interface ITeller {
  // --- Events ---

  event LoanCreated(
    address lender,
    address borrower,
    uint256 principal,
    uint256 rate,
    uint256 _now
  );

  // --- Functions ---

  function balanceOf(address borrower) external view returns (uint256);

  function createLoan(
    address lender,
    address borrower,
    uint256 principal,
    uint256 rate
  ) external;
}
