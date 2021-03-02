// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice The vault manager contains logic for vault operations, including lifecycle management
 * and providing or withdrawing collateral.
 */
interface IVaultManager {

  // --- Events ---

  event VaultCreated(address indexed owner, uint vaultId);
  event VaultUpdated(address indexed owner, uint vaultId);
  event VaultDeleted(address indexed owner, uint vaultId);

  // --- Functions ---

  function openVault(address owner, uint initialCollateral) external payable returns (uint vaultId);
}