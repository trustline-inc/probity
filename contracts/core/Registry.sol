// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

/**
 * @title Registry contract
 * @notice Stores module and EOA addresses with a role designation
 */
contract Registry {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////

    struct Role {
        bytes32 name; // name of the role
        bool isProbitySystem; // true if address a part of probity system
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////

    mapping(address => Role) public addressToRole;

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error callerIsNotAdmin();

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////

    /**
     * @dev check if caller is from governance contract address
     */
    modifier onlyByAdmin() {
        if (addressToRole[msg.sender].name != "admin") revert callerIsNotAdmin();
        _;
    }

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event ContractAdded(bytes32 roleName, address contractAddress, bool isProbitySystem);
    event ContractRemoved(bytes32 roleName, address contractAddress);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    constructor(address adminAddress) {
        addressToRole[adminAddress].name = "admin";
        addressToRole[adminAddress].isProbitySystem = true;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev registers an address with the given role
     * @param roleName of the address to be added
     * @param addr the vault owner's address
     * TODO: Change order of params (address, bytes32, bool)
     */
    function register(bytes32 roleName, address addr, bool isProbitySystem) external onlyByAdmin {
        addressToRole[addr].name = roleName;
        addressToRole[addr].isProbitySystem = isProbitySystem;
        emit ContractAdded(roleName, addr, isProbitySystem);
    }

    /**
     * @dev unregister an address
     * @param addr to be removed
     */
    function unregister(address addr) external onlyByAdmin {
        bytes32 roleName = addressToRole[addr].name;
        addressToRole[addr].name = bytes32("");
        addressToRole[addr].isProbitySystem = false;
        emit ContractRemoved(roleName, addr);
    }

    /**
     * @dev check if an address has a particular roleName
     * @param roleName to check against
     * @param addr to check
     */
    function checkRole(bytes32 roleName, address addr) external view returns (bool) {
        return addressToRole[addr].name == roleName;
    }

    /**
     * @dev check if an address is in the registry and isProbitySystem is true
     * @param addr to be check
     */
    function checkIfProbitySystem(address addr) external view returns (bool) {
        return addressToRole[addr].name != bytes32("") && addressToRole[addr].isProbitySystem;
    }

    /**
     * @dev check if an address is in the registry
     * @param addr to be check
     */
    function checkIfRegistered(address addr) external view returns (bool) {
        return addressToRole[addr].name != bytes32("");
    }
}
