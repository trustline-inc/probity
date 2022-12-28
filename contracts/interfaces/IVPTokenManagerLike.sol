// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface IVPTokenManagerLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    function delegate(address _to, uint256 _bips) external;
}
