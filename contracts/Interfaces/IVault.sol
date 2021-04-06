// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/Base.sol";

/**
 * @notice Contains logic for vault operations, including lifecycle management
 * and depositing or withdrawing collateral.
 */
interface IVault {
  // --- Events ---

  event VaultUpdated(
    address indexed owner,
    uint256 collateral,
    uint256 encumbered,
    uint256 unencumbered
  );

  // --- Functions ---

  function totalEncumbered() external view returns (uint256);

  function debtEncumbered() external view returns (uint256);

  function equityEncumbered() external view returns (uint256);

  /**
   * @notice Fetches details about the message sender's vault.
   * @return (collateral, encumbered, unencumbered)
   */
  function get(address owner)
    external
    view
    returns (
      uint256,
      uint256,
      uint256
    );

  /**
   * @notice Locks the collateral to issue equity or take debt.
   */
  function lock(address owner, uint256 amount) external;

  /**
   * @notice Unlocks the collateral after redeeming equity or repaying debt.
   */
  function unlock(address owner, uint256 amount) external;

  /**
   * @notice Call this to add collateral to an existing vault.
   */
  function deposit() external payable;

  /**
   * @notice Call this to withdraw unencumbered collateral from a vault.
   * @param amount - The amount of unencumbered collateral to withdraw.
   */
  function withdraw(uint256 amount) external;
}
