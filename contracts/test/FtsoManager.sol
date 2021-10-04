pragma solidity ^0.4.0;

interface FtsoManager {
  function getCurrentRewardEpoch() external view returns (uint256);
}

contract FTSOManager {
  uint256 currentRewardEpoch;

  constructor() {
    currentRewardEpoch = 0;
  }

  function getCurrentRewardEpoch() external view returns (uint256) {
    return currentRewardEpoch;
  }

  // A helper function for testing
  function setCurrentRewardEpoch(uint256 newRewardEpoch) external {
    currentRewardEpoch = newRewardEpoch;
  }
}
