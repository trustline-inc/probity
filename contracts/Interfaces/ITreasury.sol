// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages minting and burning of Aurei.
 */
interface ITreasury {

  // --- Events ---

  function balanceOf(uint vaultId) external view returns (uint256);

  function mint(uint256 amount, uint vaultId) external;

  function burn(uint256 amount, uint vaultId) external;
}
