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
    uint256 loanCollateral,
    uint256 stakedCollateral
  );

  // --- Functions ---

  function totalLoanCollateral() external view returns (uint256);

  function totalStakedCollateral() external view returns (uint256);

  /**
   * @notice Fetches details about the message sender's vault.
   * @return (lockedCollateralForBorrowing, lockedCollateralForStaking)
   */
  function get(address owner) external view returns (uint256, uint256);

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
    uint256 amount
  ) external;
}
