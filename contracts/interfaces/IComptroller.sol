// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../libraries/Base.sol";

/**
 * @notice Interface for Comptroller.
 */
interface IComptroller {
  function deposit(address market) external payable;
}
