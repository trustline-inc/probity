// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ProbityMath.sol";

/**
 * @notice Contains global system constants and common functions. 
 */
contract ProbityBase {
  using SafeMath for uint;

  // One hundred percent expressed as 1 x 10^18 or 1e18
  uint constant public ONE_HUNDRED_PERCENT = 1000000000000000000; // 100%

  // Minimum collateral ratio for individual vaults
  uint constant public MIN_COLLATERAL_RATIO = 1500000000000000000; // 150%
}