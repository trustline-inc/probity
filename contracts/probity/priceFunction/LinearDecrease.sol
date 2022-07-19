// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../../dependencies/Math.sol";

interface PriceCalc {
    function price(uint256 startingPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice);
}

/**
 * @title LinearDecrease contract
 * @notice Calculate the current price over a linearly decreasing function from starting price to zero over timeToZero
 */
contract LinearDecrease is PriceCalc {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    uint256 public timeToZero = 2 days;

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev calculate and return the current price based on how much time has passed and starting price
     * @param startingPrice to be used in calculation
     * @param timeElapsed in seconds
     */
    function price(uint256 startingPrice, uint256 timeElapsed)
        external
        view
        override
        returns (uint256 calculatedPrice)
    {
        if (timeElapsed >= timeToZero) return 0;
        return Math._rmul(startingPrice, Math._mul(timeToZero - timeElapsed, RAY) / timeToZero);
    }
}
