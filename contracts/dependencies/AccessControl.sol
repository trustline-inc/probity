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

    modifier onlyByProbity() {
        require(
            registry.checkValidity(msg.sender) && !registry.checkValidity("whitelisted", msg.sender),
            "AccessControl/onlyByProbity: Caller must be from Probity system contract"
        );
        _;
    }

    modifier onlyByWhiteListed() {
        require(registry.checkValidity("whitelisted", msg.sender), "AccessControl/onlyByWhiteListed: Access forbidden");
        _;
    }

    ///////////////////////////////////
    // Constructor
    ///////////////////////////////////
    constructor(address registryAddress) {
        registry = IRegistry(registryAddress);
    }
}
