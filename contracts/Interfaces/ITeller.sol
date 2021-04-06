// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages debts for all vaults.
 */
interface ITeller {
  // --- Events ---

  event LoanCreated(
    address borrower,
    uint256 collateral,
    uint256 principal,
    uint256 rate,
    uint256 timestamp
  );

  event Repayment(
    address borrower,
    uint256 amount,
    uint256 collateral,
    uint256 timestamp
  );

  // --- Functions ---

  function balanceOf(address borrower) external view returns (uint256);

  function createLoan(uint256 collateral, uint256 principal) external;

  function getAPR() external view returns (uint256);

  function getMPR() external view returns (uint256);

  function getAccumulator() external view returns (uint256);

  function getScaledAccumulator() external view returns (uint256);

  function totalDebt() external view returns (uint256);
}
