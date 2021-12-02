// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IRegistry.sol";

contract AccessControl {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
    IRegistry public registry;

    ///////////////////////////////////
    // Modifiers
    ///////////////////////////////////
    modifier onlyBy(bytes32 name) {
        require(registry.checkValidity(name, msg.sender), "AccessControl/OnlyBy: Caller does not have permission");
        _;
    }

    modifier onlyByRegistered() {
        require(
            registry.checkValidity(msg.sender),
            "AccessControl/onlyByRegistered: Caller is not a registered contract"
        );
        _;
    }

    modifier onlyByWhiteListed() {
        require(
            registry.checkValidity("whiteListed", msg.sender),
            "AccessControl/onlyByWhiteListed: Only Whitelisted user can call this"
        );
        _;
    }

    ///////////////////////////////////
    // Constructor
    ///////////////////////////////////
    constructor(address registryAddress) {
        registry = IRegistry(registryAddress);
    }
}
