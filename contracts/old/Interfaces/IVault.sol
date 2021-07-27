// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "../Dependencies/Base.sol";

/**
 * @notice Contains logic for vault operations, including lifecycle management
 * and depositing or withdrawing collateral.
 */
interface IVault {
  // --- Events ---

  event VaultUpdated(
    address indexed owner,
    uint256 loanCollateral,
    uint256 stakedCollateral
  );

  // --- Functions ---

  function getUsers() external view returns (address[] memory);

  /**
   * @notice Fetches collateral balances of the owner's vault.
   * @return (loanCollateral, stakedCollateral)
   */
  function balanceOf(address owner) external view returns (uint256, uint256);

  /**
   * @notice Call this to add collateral to an existing vault.
   */
  function deposit(Base.Activity activity, address owner) external payable;

  /**
   * @notice Call this to withdraw collateral from a vault.
   * @param amount - The amount of collateral to withdraw.
   */
  function withdraw(
    Base.Activity activity,
    address owner,
    address recipient,
    uint256 amount
  ) external;
}
