// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface Eventful {
  event Log(
    bytes32 indexed contractName,
    bytes32 indexed action,
    address caller
  );
  event LogVarUpdate(
    bytes32 indexed contractName,
    bytes32 indexed collId,
    bytes32 indexed variable,
    uint256 oldValue,
    uint256 newValue
  );
  event LogVarUpdate(
    bytes32 indexed contractName,
    bytes32 indexed variable,
    uint256 oldValue,
    uint256 newValue
  );
  event LogVarUpdate(
    bytes32 indexed contractName,
    bytes32 indexed collId,
    bytes32 indexed variable,
    address oldValue,
    address newValue
  );
}
