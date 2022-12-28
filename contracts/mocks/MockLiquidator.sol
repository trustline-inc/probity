// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

contract MockLiquidator {
    struct Asset {
        address auctioneer;
        uint256 debtPenaltyFee;
        uint256 equityPenaltyFee;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10 ** 27;

    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => bool) public states;
    uint256 public lastReduceAuctionDebt;

    function setAssetType(bytes32 assetId, address auctioneer) external {
        assets[assetId].auctioneer = auctioneer;
    }

    function reduceAuctionDebt(uint256 amount) external {
        lastReduceAuctionDebt = amount;
    }
}
