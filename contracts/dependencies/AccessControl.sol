// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.4;

import "../interfaces/IRegistryLike.sol";

/**
 * @title AccessControl contract
 * @notice Modifiers to check if caller has roles in the registry contract
 */
contract AccessControl {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
    IRegistryLike public registry; // registry contract

    ///////////////////////////////////
    // Errors
    ///////////////////////////////////

    error callerDoesNotHaveRequiredRole(bytes32 roleName);
    error callerIsNotFromProbitySystem();

    ///////////////////////////////////
    // Modifiers
    ///////////////////////////////////

    /**
     * @dev check if the caller has been registered with a specific role in the registry
     * @param name role name in the registry
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
        registry = IRegistryLike(registryAddress);
    }

    ///////////////////////////////////
    // External Functions
    ///////////////////////////////////

    /**
     * @dev set the new registry address, used to replace registry module
     */
    function setRegistryAddress(IRegistryLike newRegistryAddress) external onlyBy("gov") {
        registry = newRegistryAddress;
    }
}
