// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice This is the main contract which calls other contracts for specific sets of business logic.
 */
interface IProbity {

  // --- Events ---

  // --- Functions ---

  /**
   * @notice Call this to open a vault for an account for the first time. Adds `msg.value` of inital collateral.
   * @return vaultId - a numerical nonce representing the vault ID.
   */
  function openVault() external payable returns (uint vaultId);

  /**
   * @notice Call this to open a vault for an account for the first time. Adds `msg.value` of inital collateral.
   * @param _vaultId - The vault ID.
   * @param _grantee - Address of the grantee
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function grantVaultAccess(uint _vaultId, address _grantee) external returns (bool result);

  /**
   * @notice Call this to add collateral to an existing vault.
   * @param _vaultId - The vault ID.
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function addCollateral(uint _vaultId) external payable;

  /**
   * @notice Call this to withdraw collateral from a vault. Borrower's debt must be paid
   * back in order for withdrawal. Lenders can only withdraw collateral on-demand from the
   * variable rate market. Withdrawing collateral from a fixed rate market requires loan
   * maturity.
   * @param _vaultId - The vault ID.
   * @param _amount - The amount of collateral to withdraw. If there is outstanding debt,
   * the amount must not be more than allowed by the collateralization ratio.
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function withdrawCollateral(uint _vaultId, uint _amount) external;

  /**
   * @notice Call this to permanently close a vault.
   * @param _vaultId - The vault ID.
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function closeVault(uint _vaultId) external;
}