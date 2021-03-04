// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Dependencies/ProbityBase.sol";
import "./Interfaces/IRegistry.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Stores contract addresses.
 */
contract Registry is IRegistry, Ownable {
  mapping (ProbityBase.Contract => address) private contracts;

  constructor() Ownable(msg.sender) {
  }

  function setupContractAddress(ProbityBase.Contract name, address _addr) external override onlyOwner {
    contracts[name] = _addr;
  } 
  function getContractAddress(ProbityBase.Contract name) external view override returns (address) {
    return contracts[name];  
  }

}
