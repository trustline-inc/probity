// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

contract MockVPAssetManager {
    address public rewardCollectedUser;

    function collectRewardForUser(address user) external {
        rewardCollectedUser = user;
    }
}
