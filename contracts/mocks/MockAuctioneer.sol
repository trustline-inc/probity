pragma solidity ^0.8.0;

contract MockAuctioneer {
    struct LastAuctionCall {
        uint256 auctionId;
        address recipient;
    }

    struct LastStartAuctionCall {
        bytes32 collId;
        uint256 lotSize;
        uint256 debtSize;
        address owner;
        address beneficiary;
    }

    LastAuctionCall public lastAuctionCall;
    LastStartAuctionCall public lastStartAuctionCall;

    function cancelAuction(uint256 auctionId, address recipient) external {
        lastAuctionCall.auctionId = auctionId;
        lastAuctionCall.recipient = recipient;
    }

    function startAuction(
        bytes32 collId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary
    ) external {
        lastStartAuctionCall.collId = collId;
        lastStartAuctionCall.lotSize = lotSize;
        lastStartAuctionCall.debtSize = debtSize;
        lastStartAuctionCall.owner = owner;
        lastStartAuctionCall.beneficiary = beneficiary;
    }
}
