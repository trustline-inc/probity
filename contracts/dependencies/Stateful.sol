// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./AccessControl.sol";

contract Stateful is AccessControl {
  event LogStateChange(bytes32 name, bool newState);

  mapping(bytes32 => bool) public states;

  modifier onlyWhen(bytes32 name, bool set) {
    require(states[name] == set, "Stateful/onlyWhen: State check failed");
    _;
  }

  // solhint-disable-next-line
  constructor(address registryAddress) AccessControl(registryAddress) {}

  function setState(bytes32 name, bool set) external onlyBy("gov") {
    states[name] = set;
    emit LogStateChange(name, set);
  }
}
