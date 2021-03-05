// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Interfaces/IMoneyMarket.sol";

/**
 * @notice A market for money.
 */
contract MoneyMarket is IMoneyMarket, Ownable {
  // --- Event ---

  // --- Constructor ---

  constructor() Ownable(msg.sender) {}
}
