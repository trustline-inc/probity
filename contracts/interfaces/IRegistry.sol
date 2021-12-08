// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages contracts registry
 */
interface IRegistry {
    function setupAddress(bytes32 name, address addr) external;

    function removeAddress(address addr) external;

    function checkValidity(address addr) external returns (bool);

    function checkValidity(bytes32 name, address addr) external returns (bool);
}
