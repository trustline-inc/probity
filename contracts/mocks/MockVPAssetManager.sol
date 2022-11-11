// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

contract MockVPAssetManager {
    address public rewardCollectedUser;

    function collectRewardForUser(address user) external {
        rewardCollectedUser = user;
    }
}
