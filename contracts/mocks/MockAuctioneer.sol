pragma solidity ^0.8.0;

contract MockAuctioneer {
    struct LastAuctionCall {
        uint256 auctionId;
        address recipient;
    }

    LastAuctionCall public lastAuctionCall;

    function cancelAuction(uint256 auctionId, address recipient) external {
        lastAuctionCall.auctionId = auctionId;
        lastAuctionCall.recipient = recipient;
    }
}
