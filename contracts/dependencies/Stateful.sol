// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AccessControl.sol";

contract Stateful is AccessControl {
  event LogStateChange(bytes32 name, bool newState);

  mapping(bytes32 => bool) states;

  modifier onlyWhen(bytes32 name, bool set) {
    require(states[name] == set, "State check failed");
    _;
  }

  constructor(address registryAddress) AccessControl(registryAddress) {}

  function setState(bytes32 name, bool set) external onlyBy("gov") {
    states[name] = set;
    emit LogStateChange(name, set);
  }
}
