pragma solidity ^0.8.0;

import "../Interfaces/IRegistry.sol";

contract Governable {
  IRegistry registry;

  constructor(address registryAddress) {
    registry = IRegistry(registryAddress);
  }

  modifier onlyByGovernance() {
    require(
      msg.sender == registry.getContractAddress(IRegistry.Contract.Governance),
      "This call can only be made by governance contract"
    );
    _;
  }
}
