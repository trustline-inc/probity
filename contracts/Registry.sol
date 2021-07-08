// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "./Dependencies/Base.sol";
import "./Dependencies/Ownable.sol";
import "./Interfaces/IRegistry.sol";
import "hardhat/console.sol";

/**
 * @notice Stores contract addresses.
 */
contract Registry is IRegistry, Ownable {
  // --- Data ---

  mapping(Base.Contract => address) private contracts;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {}

  // --- External Functions ---

  function setupContractAddress(Base.Contract name, address _addr)
    external
    override
    onlyOwner
  {
    contracts[name] = _addr;
  }

  function getContractAddress(Base.Contract name)
    external
    view
    override
    returns (address)
  {
    return contracts[name];
  }
}
