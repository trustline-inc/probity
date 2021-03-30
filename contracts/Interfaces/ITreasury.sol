// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages a treasury of Aurei.
 */
interface ITreasury {
  // --- Events ---

  event TreasuryUpdated(address indexed owner, uint256 equity);

  // --- Functions ---

  function balanceOf(address owner) external view returns (uint256);

  function totalSupply() external view returns (uint256);

  function issue(uint256 collateral, uint256 equity) external;

  function redeem(uint256 collateral, uint256 equity) external;

  function fundLoan(address borrower, uint256 principal) external;
}
