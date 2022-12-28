// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface ITokenLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    function mint(address user, uint256 amount) external;

    function burn(address user, uint256 amount) external;
}
