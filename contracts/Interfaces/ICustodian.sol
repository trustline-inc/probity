// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/ProbityBase.sol";

/**
 * @notice The custodian contains logic for vault operations, including lifecycle management
 * and providing or withdrawing collateral.
 */
interface ICustodian {
  // --- Events ---

  event VaultUpdated(address indexed owner, uint256 indexed vaultId);
  event VaultDeleted(address indexed owner, uint256 indexed vaultId);

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

  function lockCollateral(uint256 amount, address owner) external;

  function increaseCollateral(address _owner, uint256 amount) external;

  function decreaseCollateral(address _owner, uint256 amount) external;
}
