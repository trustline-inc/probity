// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

/**
 * @notice Common interface for the TCN token.
 */
interface ITCN is IERC20, IERC2612 {
  // --- Events ---

  // --- Functions ---

  function mint(address _account, uint256 _amount) external;

  function burn(address _account, uint256 _amount) external;
}
