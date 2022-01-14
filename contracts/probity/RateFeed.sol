// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function updateInflationRate(uint256 inflationRate) external;
}

interface FtsoLike {
    function getCurrentInflationRate() external returns (uint256 _inflationRate, uint256 _timestamp);
}

contract RateFeed is Stateful, Eventful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    FtsoLike public ftso;
    uint256 private constant RAY = 1e27;
    VaultEngineLike public immutable vaultEngine;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        FtsoLike ftsoAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        ftso = ftsoAddress;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @notice Gets the current inflation rate.
     */
    function getInflationRate() public returns (uint256 inflationRate) {
        (inflationRate, ) = ftso.getCurrentInflationRate();
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////
    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * RAY) + (y / 2)) / y;
    }
}
