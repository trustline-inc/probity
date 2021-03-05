// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages debts for all vaults.
 */
interface ITeller {

  // --- Events ---

  event LoanCreated(address lender, address borrower, uint principal, uint _now);

  // --- Functions ---

  function createLoan(address lender, address borrower, uint principal) external;

}