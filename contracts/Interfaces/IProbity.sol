// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/ProbityBase.sol";

/**
 * @notice This is the main contract which calls other contracts for specific sets of business logic.
 */
interface IProbity {

  // --- Events ---

  event VaultCreated(address indexed owner, uint vaultId);

  // --- Functions ---

  /**
   * @notice Call this to open a vault for the first time. Adds `msg.value` of inital collateral.
   * @param debt - The amount of Aurei to borrow from the treasury.
   * @param equity - The amount of Aurei to mint for lending.
   * @return vaultId - a numerical nonce representing the vault ID.
   * @dev Requires sufficient collateralization before opening vault.
   */
  function openVault(uint debt, uint equity) external payable returns (uint vaultId);

  /**
   * @notice Call this to add collateral to an existing vault.
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function addCollateral() external payable;

  /**
   * @notice Call this to withdraw collateral from a vault. Borrower's debt must be paid
   * back in order for withdrawal. Lenders can only withdraw collateral on-demand from the
   * variable rate market. Withdrawing collateral from a fixed rate market requires loan
   * maturity.
   * @param _amount - The amount of collateral to withdraw. If there is outstanding debt,
   * the amount must not be more than allowed by the collateralization ratio.
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function withdrawCollateral(uint _amount) external;

  /**
   * @notice Call this to permanently close a vault.
   * @dev This method can only be called by the vault owner or an address that was granted access.
   */
  function closeVault() external;

  /**
  * @notice Fetches details about the message sender's vault.
  * @return Vault details.
  */
  function getVault() external view returns (ProbityBase.Vault memory);
}
