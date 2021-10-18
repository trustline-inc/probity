// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IRegistry.sol";

contract AccessControl {
  IRegistry registry;

  constructor(address registryAddress) {
    registry = IRegistry(registryAddress);
  }

  modifier onlyBy(bytes32 name) {
    require(
      registry.checkContractValidity(name, msg.sender),
      "AccessControl/OnlyBy: Caller does not have authority to call this"
    );
    _;
  }

  modifier onlyByRegistered() {
    require(
      registry.checkContractValidity(msg.sender),
      "AccessControl/onlyByRegistered: caller is not a registered Contract"
    );
    _;
  }
}
