// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages debt for all vaults.
 */
interface ITeller {
  // --- Events ---

  event LoanCreated(
    uint256 principal,
    uint256 collateral,
    uint256 timestamp,
    uint256 rate,
    address indexed borrower
  );

  event Repayment(
    uint256 amount,
    uint256 collateral,
    uint256 timestamp,
    address indexed borrower
  );

  // --- Functions ---

  // Read-only

  function balanceOf(address borrower) external view returns (uint256);

  function totalDebt() external view returns (uint256);

  function getAPR() external view returns (uint256);

  function getMPR() external view returns (uint256);

  function getDebtAccumulator() external view returns (uint256);

  function getCapitalAccumulator() external view returns (uint256);

  function getUtilization()
    external
    view
    returns (
      uint256,
      uint256,
      uint256
    );

  // Teller actions

  function updateRate() external;

  // User actions

  function createLoan(uint256 principal) external payable;

  function repay(uint256 amount, uint256 collateral) external;
}
