// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IRegistry.sol";

/**
 * @notice Stores contract addresses.
 */
contract Registry is IRegistry {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////

  event ContractAdded(bytes32 name, address contractAddress);
  event ContractRemoved(bytes32 name, address contractAddress);

  /////////////////////////////////////////
  // Modifiers
  /////////////////////////////////////////

  modifier onlyByGov() {
    require(
      addressToName[msg.sender] == "gov",
      "Registry/onlyByGov: caller is not from 'gov' address"
    );
    _;
  }

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  mapping(address => bytes32) private addressToName;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(address govAddress) {
    addressToName[govAddress] = "gov";
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function setupContractAddress(bytes32 name, address addr)
    external
    override
    onlyByGov
  {
    addressToName[addr] = name;
    emit ContractAdded(name, addr);
  }

  function removeContractAddress(address addr) external override onlyByGov {
    bytes32 name = addressToName[addr];
    addressToName[addr] = bytes32("");
    emit ContractRemoved(name, addr);
  }

  function checkContractValidity(bytes32 name, address addr)
    external
    view
    override
    returns (bool)
  {
    return addressToName[addr] == name;
  }

  function checkContractValidity(address addr)
    external
    view
    override
    returns (bool)
  {
    return addressToName[addr] != bytes32("");
  }
}
