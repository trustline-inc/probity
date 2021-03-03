// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./SafeMath.sol";

library ProbityMath {
  using SafeMath for uint;

  uint internal constant DECIMAL_PRECISION = 1e18;
}