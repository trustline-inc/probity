// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Contains global system constants and common functions.
 */
contract ProbityBase {
  // --- Registered contracts ---

  enum Contract {Aurei, Exchange, Probity, Teller, Treasury, Vault}

  // --- Math constants ---

  // One as 1e18, or as 100%
  uint256 constant ONE = 10**18;

  // Minimum collateral ratio for individual vaults (150%)
  uint256 public constant MIN_COLLATERAL_RATIO = 1500000000000000000;

  // Seconds in year: 365 * 24 * 3600;
  uint256 public constant SECONDS_IN_YEAR = 31536000;
}
