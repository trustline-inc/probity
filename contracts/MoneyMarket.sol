// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IMoneyMarket.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice A market for money.
 */
contract MoneyMarket is IMoneyMarket, Ownable {

  // --- Event ---

  // --- Constructor ---

  constructor() {
    
  }

}