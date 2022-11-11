// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

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
     * @param expectedState the expected state
     */
    modifier onlyWhen(bytes32 name, bool expectedState) {
        if (states[name] != expectedState) revert stateCheckFailed(name, states[name]);
        _;
    }

    ///////////////////////////////////
    // Events
    ///////////////////////////////////
    event LogStateChange(bytes32 name, bool newState);

    ///////////////////////////////////
    // Errors
    ///////////////////////////////////

    error stateCheckFailed(bytes32 name, bool currentState);

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
}
