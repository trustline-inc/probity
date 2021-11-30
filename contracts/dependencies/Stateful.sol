// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./AccessControl.sol";

contract Stateful is AccessControl {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
    mapping(bytes32 => bool) public states;

    ///////////////////////////////////
    // Modifiers
    ///////////////////////////////////

    modifier onlyWhen(bytes32 name, bool set) {
        require(states[name] == set, "Stateful/onlyWhen: State check failed");
        _;
    }

    ///////////////////////////////////
    // Events
    ///////////////////////////////////
    event LogStateChange(bytes32 name, bool newState);
    event ShutdownInitiated();

    ///////////////////////////////////
    // Constructor
    ///////////////////////////////////
    // solhint-disable-next-line
    constructor(address registryAddress) AccessControl(registryAddress) {}

    ///////////////////////////////////
    // External Functions
    ///////////////////////////////////
    function setState(bytes32 name, bool set) external onlyBy("gov") {
        states[name] = set;
        emit LogStateChange(name, set);
    }

    function setShutdownState() external onlyBy("shutdown") {
        states[bytes32("shutdown")] = true;
        emit ShutdownInitiated();
    }
}
