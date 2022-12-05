// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

contract MockAuctioneer {
    struct LastAuctionCall {
        uint256 auctionId;
        address recipient;
    }

    struct LastStartAuctionCall {
        bytes32 assetId;
        uint256 lotSize;
        uint256 debtSize;
        address owner;
        address beneficiary;
        address vpAssetManager;
        bool sellAllLot;
    }

    LastAuctionCall public lastAuctionCall;
    LastStartAuctionCall public lastStartAuctionCall;

    function cancelAuction(uint256 auctionId, address recipient) external {
        lastAuctionCall.auctionId = auctionId;
        lastAuctionCall.recipient = recipient;
    }

    function startAuction(
        bytes32 assetId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary,
        address vpAssetManager,
        bool sellAllLot
    ) external {
        lastStartAuctionCall.assetId = assetId;
        lastStartAuctionCall.lotSize = lotSize;
        lastStartAuctionCall.debtSize = debtSize;
        lastStartAuctionCall.owner = owner;
        lastStartAuctionCall.beneficiary = beneficiary;
        lastStartAuctionCall.sellAllLot = sellAllLot;
        lastStartAuctionCall.vpAssetManager = vpAssetManager;
    }
}
