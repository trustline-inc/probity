// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Facilitates liquidation of under-collateralized vaults.
 */
interface ILiquidation {
  // --- Events ---

  event Liquidation(address indexed owner, uint256 vaultId);
}
