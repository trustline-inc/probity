// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Interfaces/IRegistry.sol";

/**
 * @notice Stores contract addresses.
 */
contract Registry is IRegistry, Ownable {
  // --- Data ---

  mapping(ProbityBase.Contract => address) private contracts;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {}

  // --- External Functions ---

  function setupContractAddress(ProbityBase.Contract name, address _addr)
    external
    override
    onlyOwner
  {
    contracts[name] = _addr;
  }

  function getContractAddress(ProbityBase.Contract name)
    external
    view
    override
    returns (address)
  {
    return contracts[name];
  }
}
