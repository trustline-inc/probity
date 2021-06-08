// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

/**
 * @notice Common interface for the Aurei token.
 */
interface IAurei is IERC20, IERC20Permit {
  function mint(address _account, uint256 _amount) external;

  function burn(address _account, uint256 _amount) external;
}
