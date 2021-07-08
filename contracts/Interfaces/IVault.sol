// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/Base.sol";

/**
 * @notice Contains logic for vault operations, including lifecycle management
 * and depositing or withdrawing collateral.
 */
interface IVault {
  function depositCollateral(
    bytes32 collateral,
    address user,
    uint256 amount
  ) external;

  function withdrawCollateral(
    bytes32 collateral,
    address user,
    uint256 amount
  ) external;
}
