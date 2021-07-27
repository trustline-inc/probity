// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Interfaces/IRegistry.sol";

contract AccessControl {
  IRegistry registry;

  constructor(address registryAddress) {
    registry = IRegistry(registryAddress);
  }

  modifier onlyBy(bytes32 name) {
    require(
      registry.checkIfValidContract(name, msg.sender),
      "ACCESS: Caller does not have authority to call this"
    );
    _;
  }

  modifier onlyByRegistered() {
    require(
      registry.checkIfValidContract(msg.sender),
      "ACCESS: caller is not a registered Contract"
    );
    _;
  }
}
