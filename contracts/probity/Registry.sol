// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Stores contract addresses.
 */
contract Registry {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    mapping(address => bytes32) public addressToName;

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////
    modifier onlyByGov() {
        require(addressToName[msg.sender] == "gov", "Registry/onlyByGov: caller is not from 'gov' address");
        _;
    }

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event ContractAdded(bytes32 name, address contractAddress);
    event ContractRemoved(bytes32 name, address contractAddress);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address govAddress) {
        addressToName[govAddress] = "gov";
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////
    function setupAddress(bytes32 name, address addr) external onlyByGov {
        addressToName[addr] = name;
        emit ContractAdded(name, addr);
    }

    function removeAddress(address addr) external onlyByGov {
        bytes32 name = addressToName[addr];
        addressToName[addr] = bytes32("");
        emit ContractRemoved(name, addr);
    }

    function checkValidity(bytes32 name, address addr) external view returns (bool) {
        return addressToName[addr] == name;
    }

    function checkValidity(address addr) external view returns (bool) {
        return addressToName[addr] != bytes32("");
    }
}
