// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./libraries/Base.sol";
import "./libraries/Ownable.sol";
import "./interfaces/IRegistry.sol";
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
