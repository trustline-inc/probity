// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages a treasury of Aurei.
 */
interface ITreasury {
  // --- Events ---

  event Stake(
    uint256 capital,
    uint256 collateral,
    uint256 timestamp,
    address indexed owner
  );

  event Redemption(
    uint256 capital,
    uint256 collateral,
    uint256 timestamp,
    address indexed owner
  );

  event Withdrawal(
    uint256 capital,
    uint256 collateral,
    uint256 timestamp,
    address indexed owner
  );

  // --- Functions ---

  // Read-only

  function capitalOf(address owner) external view returns (uint256);

  function interestOf(address owner) external view returns (uint256);

  function totalSupply() external view returns (uint256);

  // Treasury actions

  function fundLoan(address borrower, uint256 principal) external;

  // User actions

  function stake(uint256 capital) external payable;

  function redeem(uint256 collateral, uint256 capital) external;

  function withdraw(uint256 amount, bool tcn) external;
}
