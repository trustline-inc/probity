// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface ILiquidatorLike {
    function reduceAuctionDebt(uint256 amount) external;
}
