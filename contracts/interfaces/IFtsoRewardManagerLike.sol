pragma solidity 0.8.4;

interface IFtsoRewardManagerLike {
    function claimRewardFromDataProviders(
        address payable _recipient,
        uint256[] memory _rewardEpochs,
        address[] memory _dataProviders
    ) external returns (uint256 _rewardAmount);

    function getEpochsWithClaimableRewards() external view returns (uint256 _startEpochId, uint256 _endEpochId);
}
