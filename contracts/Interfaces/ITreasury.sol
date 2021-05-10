// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages a treasury of Aurei.
 */
interface ITreasury {
  // --- Events ---

  event TreasuryUpdated(
    address indexed owner,
    uint256 deltaCollateral,
    uint256 deltaCapital
  );

  // --- Functions ---

  function balanceOf(address owner) external view returns (uint256);

  function fundLoan(address borrower, uint256 principal) external;

  function issue(uint256 collateral, uint256 capital) external;

  function redeem(uint256 collateral, uint256 capital) external;

  function withdraw(uint256 amount, bool tcn) external;
}
