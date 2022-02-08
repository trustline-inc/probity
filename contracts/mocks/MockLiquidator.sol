pragma solidity ^0.8.0;

contract MockLiquidator {
    struct Asset {
        address auctioneer;
        uint256 debtPenaltyFee;
        uint256 equityPenaltyFee;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => bool) public states;

    function setAssetType(bytes32 assetId, address auctioneer) external {
        assets[assetId].auctioneer = auctioneer;
    }

    function setShutdownState() external {
        states["shutdown"] = true;
    }
}
