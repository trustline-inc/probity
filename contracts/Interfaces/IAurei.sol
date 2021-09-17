// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IERC20.sol";
import "./IERC2612.sol";

/**
 * @notice Common interface for the Aurei token.
 */
interface IAurei is IERC20, IERC2612 {
  // --- Events ---

  // --- Functions ---

  function mint(address _account, uint256 _amount) external;

  function burn(address _account, uint256 _amount) external;
}
