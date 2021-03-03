// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ILiquidation.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Facilitates liquidation of under-collateralized vaults.
 */
contract Liquidation is ILiquidation, Ownable {

  constructor() Ownable(msg.sender) {

  }
}
