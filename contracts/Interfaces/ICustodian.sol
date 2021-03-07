// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/ProbityBase.sol";

/**
 * @notice The custodian contains logic for vault operations, including lifecycle management
 * and providing or withdrawing collateral.
 */
interface ICustodian {
  // --- Events ---

  event VaultCreated(address indexed owner, uint256 vaultId);
  event VaultUpdated(address indexed owner, uint256 vaultId);
  event VaultDeleted(address indexed owner, uint256 vaultId);

  // --- Functions ---

  function createVault(address owner, uint256 initialCollateral)
    external
    returns (uint256 vaultId);

  function getVaultByOwner(address _owner)
    external
    view
    returns (ProbityBase.Vault memory);

  /**
   * @notice This function checks borrower credibility for new loan request.
   * @dev This method is called by Teller for loan credibility.
   */
  function checkBorrowerEligibility(uint256 debt, address borrower) external;

  function requireSufficientCollateral(
    uint256 debt,
    uint256 equity,
    uint256 collateral
  ) external pure;
}
