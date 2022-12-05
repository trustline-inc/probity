pragma solidity 0.8.4;

interface IPriceFeedLike {
    function getPrice(bytes32 assetId) external returns (uint256 _price);
}
