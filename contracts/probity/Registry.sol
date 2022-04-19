// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @title Registry contract
 * @notice Stores the relevant address for the probity system with a role
 */
contract Registry {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////

    struct Role {
        bytes32 name; // name of the role
        bool isProbitySystem; // true if address a part of probity system contract
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    mapping(address => bytes32) public addressToRole;

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////
    /**
     * @dev check if caller is from Governance contract address
     */
    modifier onlyByGov() {
        require(addressToRole[msg.sender] == "gov", "Registry/onlyByGov: caller is not from 'gov' address");
        _;
    }

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event ContractAdded(bytes32 roleName, address contractAddress);
    event ContractRemoved(bytes32 roleName, address contractAddress);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address govAddress) {
        addressToRole[govAddress] = "gov";
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev add an address to registry with the role
     * @param roleName of the address to be added
     * @param addr the vault owner's address
     */
    function setupAddress(
        bytes32 roleName,
        address addr,
        bool isProbitySystem
    ) external onlyByGov {
        addressToRole[addr] = roleName;
        emit ContractAdded(roleName, addr);
    }

    /**
     * @dev remove an address from registry
     * @param addr to be removed
     */
    function removeAddress(address addr) external onlyByGov {
        bytes32 roleName = addressToRole[addr];
        addressToRole[addr] = bytes32("");
        emit ContractRemoved(roleName, addr);
    }

    /**
     * @dev check if an address has a particular roleName
     * @param roleName to check against
     * @param addr to check
     */
    function checkValidity(bytes32 roleName, address addr) external view returns (bool) {
        return addressToRole[addr] == roleName;
    }

    /**
     * @dev check if an address is in the registry
     * @param addr to be check
     */
    function checkValidity(address addr) external view returns (bool) {
        return addressToRole[addr] != bytes32("");
    }
}
