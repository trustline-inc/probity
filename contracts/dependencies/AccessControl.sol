// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRegistry {
    function checkIfProbitySystem(address addr) external returns (bool);

    function checkRole(bytes32 name, address addr) external returns (bool);
}

/**
 * @title AccessControl contract
 * @notice Modifiers to check if caller has roles in the registry contract
 */
contract AccessControl {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
    IRegistry public registry; // registry contract

    ///////////////////////////////////
    // Modifiers
    ///////////////////////////////////

    /**
     * @dev check if the caller has been registered with name in the registry
     * @param name in the registry
     */
    modifier onlyBy(bytes32 name) {
        require(registry.checkRole(name, msg.sender), "AccessControl/onlyBy: Caller does not have permission");
        _;
    }

    /**
     * @dev check if the caller is from one of the Probity system's contract
     */
    modifier onlyByProbity() {
        require(
            registry.checkIfProbitySystem(msg.sender),
            "AccessControl/onlyByProbity: Caller must be from Probity system contract"
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
