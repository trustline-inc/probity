// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/ProbityBase.sol";

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

  function createVault(address owner, uint initialCollateral) external returns (uint vaultId);

  function getVaultByOwner(address _owner) external view returns (ProbityBase.Vault memory);
}
