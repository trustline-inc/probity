// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages a treasury of Aurei.
 */
interface ITreasury {

  // --- Events ---

  event TreasuryIncrease(uint vaultId, uint amount);
  event TreasuryDecrease(uint vaultId, uint amount);

  // --- Functions ---

  function balanceOf(uint vaultId) external view returns (uint256);

  function addToTreasury(uint256 amount, uint vaultId) external;

  function removeFromTreasury(uint256 amount, uint vaultId) external;
}
