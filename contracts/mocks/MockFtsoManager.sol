// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

contract MockFtsoManager {
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
