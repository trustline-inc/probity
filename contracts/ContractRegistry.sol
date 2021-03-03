// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IContractRegistry.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Registers stablecoin system smart contracts.
 * @dev Adapted from "Name Registry" pattern described at https://medium.com/@i6mi6/solidty-smart-contracts-design-patterns-ecfa3b1e9784
 */
contract ContractRegistry is IContractRegistry, Ownable {

  // --- Data ---

  // --- Constructor ---

  constructor() Ownable(msg.sender) {

  }
  // --- External Functions ---

  function registerContract(string memory name, address addr, uint16 ver) external override {

  }

  function getContractDetails(string memory name) external override returns (address, uint16) {

  }

}
