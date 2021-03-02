// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IMarketFactory.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Factory contract that deploys child market contracts.
 * @dev Adapted from "Factory" pattern described at https://medium.com/@i6mi6/solidty-smart-contracts-design-patterns-ecfa3b1e9784
 */
contract MarketFactory is IMarketFactory, Ownable {

}