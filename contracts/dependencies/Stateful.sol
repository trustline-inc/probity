// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./AccessControl.sol";

/**
 * @title Stateful contract
 * @notice Handles checking and updating states of the contract
 */

contract Stateful is AccessControl {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////

    mapping(bytes32 => bool) public states; // each state has a name in bytes32 and state in bool

    ///////////////////////////////////
    // Modifiers
    ///////////////////////////////////

    /**
     * @dev check if the contract is in a particular state
     * @param name of the state
     * @param set whether of not the state is true
     */
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

    /**
     * @dev check if the contract is in a particular state, can only be called by governance module
     * @param name of the state
     * @param set whether of not the state is true
     */
    function setState(bytes32 name, bool set) external onlyBy("gov") {
        states[name] = set;
        emit LogStateChange(name, set);
    }

    /**
     * @dev set shutdown state to true, can only be called by shutdown module
     */
    function setShutdownState() external onlyBy("shutdown") {
        states[bytes32("shutdown")] = true;
        emit ShutdownInitiated();
    }
}
