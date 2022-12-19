// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface IVPAssetManagerLike {
    function collectRewardForUser(address user) external;
}
