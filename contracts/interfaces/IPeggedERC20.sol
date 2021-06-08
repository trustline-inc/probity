// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

/**
 * @notice A pegged token.
 */
interface IPeggedERC20 is IERC20, IERC20Permit {
  // --- External Functions ---

  function mint(address _account, uint256 _amount) external;

  function burn(address _account, uint256 _amount) external;
}
