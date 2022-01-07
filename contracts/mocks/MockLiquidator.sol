pragma solidity ^0.8.0;

contract MockLiquidator {
    struct Collateral {
        address auctioneer;
        uint256 debtPenaltyFee;
        uint256 equityPenaltyFee;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant PRECISION_PRICE = 10**27;

    mapping(bytes32 => Collateral) public collateralTypes;
    mapping(bytes32 => bool) public states;

    function setCollateralType(bytes32 collId, address auctioneer) external {
        collateralTypes[collId].auctioneer = auctioneer;
    }

    function setShutdownState() external {
        states["shutdown"] = true;
    }
}
