pragma solidity 0.8.4;

interface IReservePoolLike {
    function addAuctionDebt(uint256 newDebt) external;

    function reduceAuctionDebt(uint256 debtToReduce) external;
}
