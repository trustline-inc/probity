// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface IRegistryLike {
    function checkIfProbitySystem(address addr) external returns (bool);

    function checkRole(bytes32 name, address addr) external returns (bool);
}
