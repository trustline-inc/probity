// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

/**
 * @notice Contains global system constants and common functions.
 */
contract Base {
  // --- Registered contracts ---

  enum Contract {
    Aurei,
    Bridge,
    Ftso,
    TcnToken,
    Teller,
    Treasury,
    Vault,
    LOW_APR,
    HIGH_APR
  }
  enum Activity {
    Borrow,
    Repay,
    Stake,
    Redeem,
    Withdraw,
    LiquidateLoan,
    LiquidateStake
  }

  // --- Math constants ---

  // Minimum collateral ratio for FLR vaults (150%)
  uint256 public constant LIQUIDATION_RATIO = 1500000000000000000;

  // Seconds in year: 365.25 * 24 * 60 * 60;
  uint256 public constant SECONDS_IN_YEAR = 31557600;
}
