// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IExchange.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Executes signed loan orders.
 */
contract Exchange is IExchange, Ownable {

  constructor() Ownable(msg.sender) {

  }
}
