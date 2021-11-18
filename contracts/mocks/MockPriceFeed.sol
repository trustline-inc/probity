pragma solidity ^0.8.0;

interface FtsoLike {
    function getCurrentPrice()
        external
        returns (uint256 _price, uint256 _timestamp);
}

contract MockPriceFeed {
    struct Collateral {
        uint256 liquidationRatio;
        FtsoLike ftso;
        uint256 price;
    }

    uint256 private constant RAY = 1e27;

    mapping(bytes32 => bool) public states;
    mapping(bytes32 => Collateral) public collateralTypes;

    function getPrice(bytes32 collId) public view returns (uint256 price) {
        return collateralTypes[collId].price;
    }

    function setPrice(bytes32 collId, uint256 newPrice) external {
        collateralTypes[collId].price = newPrice;
    }

    function setShutdownState() external {
        states[bytes32("shutdown")] = true;
    }
}
