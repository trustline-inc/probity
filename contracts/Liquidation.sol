// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Interfaces/ILiquidation.sol";

/**
 * @notice Facilitates liquidation of under-collateralized vaults.
 */
contract Liquidation is ILiquidation, Ownable {

  constructor() Ownable(msg.sender) {

  }
}
