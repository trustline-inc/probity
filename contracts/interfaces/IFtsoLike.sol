// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface IFtsoLike {
    function getCurrentPrice() external returns (uint256 _price, uint256 _timestamp);
}
