pragma solidity 0.8.4;

interface ILiquidatorLike {
    function reduceAuctionDebt(uint256 amount) external;
}
