// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface Eventful {
    ///////////////////////////////////
    // Events
    ///////////////////////////////////
    event LogVarUpdate(
        bytes32 indexed contractName,
        bytes32 indexed assetId,
        bytes32 indexed variable,
        uint256 oldValue,
        uint256 newValue
    );

    event LogVarUpdate(
        bytes32 indexed contractName,
        bytes32 indexed assetId,
        bytes32 indexed variable,
        address oldValue,
        address newValue
    );

    event LogVarUpdate(bytes32 indexed contractName, bytes32 indexed variable, uint256 oldValue, uint256 newValue);
    event LogVarUpdate(bytes32 indexed contractName, bytes32 indexed variable, address oldValue, address newValue);
}
