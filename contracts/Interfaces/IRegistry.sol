// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages contracts registry
 */
interface IRegistry {
  function setupContractAddress(bytes32 name, address addr) external;

  function removeContractAddress(address addr) external;

  function checkIfValidContract(address addr) external returns (bool);

  function checkIfValidContract(bytes32 name, address addr)
    external
    returns (bool);
}
