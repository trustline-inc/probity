// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Registers stablecoin system smart contracts.
 * @dev Adapted from "Name Registry" pattern described at https://medium.com/@i6mi6/solidty-smart-contracts-design-patterns-ecfa3b1e9784
 */
interface IContractRegistry {

  // --- Events ---
  
  event ContractRegistered(string name, address addr, uint16 ver);

  // --- External Functions ---

  /**
   * @notice Call this to register or update a Probity smart contract.
   * @param name - The name of the contract.
   * @param addr - The address of the contract.
   * @param ver - The version of the contract.
   */
  function registerContract(string memory name, address addr, uint16 ver) external;

  /**
   * @notice Call this to get details about a registered contract.
   * @param name - The name of the contract.
   */
  function getContractDetails(string memory name) external returns (address, uint16);

}