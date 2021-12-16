pragma solidity ^0.8.0;

contract MockPriceCalc {
    uint256 public currPrice;
    uint256 public lastStartingPrice;
    uint256 public lastTimeElapsed;

    function setPrice(uint256 newPrice) public {
        currPrice = newPrice;
    }

    function price(uint256 startingPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice) {
        lastStartingPrice = startingPrice;
        lastTimeElapsed = timeElapsed;
        return currPrice;
    }
}
