pragma solidity ^0.8.0;

contract FtsoRewardManager {
  uint256 startEpochId;
  uint256 endEpochId;
  uint256 rewardAmount;

  function claimRewardFromDataProviders(
    address payable _recipient,
    uint256[] memory _rewardEpochs,
    address[] memory _dataProviders
  ) external returns (uint256 _rewardAmount) {
    return rewardAmount;
  }

  function getEpochsWithClaimableRewards()
    external
    view
    returns (uint256 _startEpochId, uint256 _endEpochId)
  {
    return (startEpochId, endEpochId);
  }

  // helper functions
  function setStartAndEpochId(uint256 start, uint256 end) external {
    startEpochId = start;
    endEpochId = end;
  }

  function setRewardAmount(uint256 amount) external {
    rewardAmount = amount;
  }
}
