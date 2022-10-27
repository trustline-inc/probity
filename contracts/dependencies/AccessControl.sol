// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

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
    // Errors
    ///////////////////////////////////

    error callerDoesNotHaveRequiredRole(bytes32 roleName);
    error callerIsNotFromProbitySystem();

    ///////////////////////////////////
    // Modifiers
    ///////////////////////////////////

    /**
     * @dev check if the caller has been registered with name in the registry
     * @param name in the registry
     */
    modifier onlyBy(bytes32 name) {
        if (!registry.checkRole(name, msg.sender)) revert callerDoesNotHaveRequiredRole(name);
        _;
    }

    /**
     * @dev check if the caller is from one of the Probity system's contract
     */
    modifier onlyByProbity() {
        if (!registry.checkIfProbitySystem(msg.sender)) revert callerIsNotFromProbitySystem();
        _;
    }

    ///////////////////////////////////
    // Constructor
    ///////////////////////////////////
    constructor(address registryAddress) {
        registry = IRegistry(registryAddress);
    }

    ///////////////////////////////////
    // External Functions
    ///////////////////////////////////

    /**
     * @dev check if the caller is from one of the Probity system's contract
     */
    function setRegistryAddress(IRegistry newRegistryAddress) external onlyBy("gov") {
        registry = newRegistryAddress;
    }
}
