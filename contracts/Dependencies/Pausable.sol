pragma solidity ^0.8.0;

import "./Governable.sol";

// allow addition of p
contract Pausable is Governable {
  bool paused;

  modifier onlyWhenPaused() {
    require(paused == true, "This action can only be done when paused");
    _;
  }

  modifier onlyWhenUnPaused() {
    require(paused == false, "This action can only be done when unPaused");
    _;
  }

  constructor(address registryAddress) Governable(registryAddress) {}

  function pause() external onlyByGovernance {
    paused = true;
  }

  function unPause() external onlyByGovernance {
    paused = false;
  }
}
