// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "./Dependencies/Ownable.sol";
import "./Interfaces/IRegistry.sol";
import "hardhat/console.sol";

/**
 * @notice Stores contract addresses.
 */
contract Registry is IRegistry, Ownable {
  // --- Data ---

  mapping(IRegistry.Contract => address) private contracts;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {}

  // --- External Functions ---

  function setupContractAddress(IRegistry.Contract name, address _addr)
    external
    override
    onlyOwner
  {
    contracts[name] = _addr;
  }

  function getContractAddress(IRegistry.Contract name)
    external
    view
    override
    returns (address)
  {
    return contracts[name];
  }
}
