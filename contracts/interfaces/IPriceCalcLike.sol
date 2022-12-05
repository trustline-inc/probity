pragma solidity 0.8.4;

interface IPriceCalcLike {
    function price(uint256 startPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice);
}
