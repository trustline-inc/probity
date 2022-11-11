// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

contract MockPriceCalc {
    uint256 public currPrice;
    uint256 public lastStartPrice;
    uint256 public lastTimeElapsed;

    function setPrice(uint256 newPrice) public {
        currPrice = newPrice;
    }

    function price(uint256 startPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice) {
        lastStartPrice = startPrice;
        lastTimeElapsed = timeElapsed;
        return currPrice;
    }
}
