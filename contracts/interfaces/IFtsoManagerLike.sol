pragma solidity 0.8.4;

interface IFtsoManagerLike {
    function getCurrentRewardEpoch() external view returns (uint256);
}
