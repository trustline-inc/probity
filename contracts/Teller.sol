// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Interfaces/ITeller.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Teller is ITeller, Ownable {
  
  constructor() Ownable(msg.sender) {

  }

}
