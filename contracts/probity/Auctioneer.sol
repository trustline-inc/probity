// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "hardhat/console.sol";

interface VaultEngineLike {
    function moveCollateral(
        bytes32 collateral,
        address from,
        address to,
        uint256 amount
    ) external;

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;
}

interface PriceCalc {
    function price(uint256 startingPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice);
}

interface FtsoLike {
    function getCurrentPrice() external returns (uint256 _price, uint256 _timestamp);
}

interface LiquidatorLike {
    function reduceAuctionDebt(uint256 amount) external;
}

contract Auctioneer is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////

    struct Auction {
        bytes32 collId;
        uint256 lot;
        uint256 debt;
        address owner; // left over collateral will go back to this owner
        address beneficiary; // aurei will go to this address
        uint256 startPrice;
        uint256 startTime;
        bool isOver;
    }

    struct Bid {
        uint256 price;
        uint256 lot;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1.00E18;
    address public constant HEAD = address(1);

    VaultEngineLike public immutable vaultEngine;
    FtsoLike public immutable ftso;
    LiquidatorLike public liquidator;
    PriceCalc public immutable priceCalc;

    uint256 public auctionCount;
    // @todo check and fix these values
    uint256 public nextBidRatio = 1.05E18;
    uint256 public priceBuffer = 1.20E18;
    // @todo add smallest possible bid as to avoid tiny amounts
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => Bid)) public bids;
    // sorted linked list of bidders
    mapping(uint256 => mapping(address => address)) public nextHighestBidder;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event AuctionStarted(bytes32 indexed collId, uint256 indexed auctionId, uint256 lotSize);

    event BidPlaced(
        bytes32 indexed collId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 lotSize
    );

    event Sale(bytes32 indexed collId, uint256 indexed auctionId, address indexed user, uint256 price, uint256 lotSize);

    event BidRemoved(
        bytes32 indexed collId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 lotSize
    );

    event BidModified(
        bytes32 indexed collId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 oldLotSize,
        uint256 newLotSize
    );

    event AuctionEnded(bytes32 indexed collId, uint256 indexed auctionId);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        PriceCalc priceCalcAddress,
        FtsoLike ftsoAddress,
        LiquidatorLike liquidatorAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        priceCalc = priceCalcAddress;
        ftso = ftsoAddress;
        liquidator = liquidatorAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    function startAuction(
        bytes32 collId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary
    ) external onlyBy("liquidator") {
        (uint256 currPrice, ) = ftso.getCurrentPrice();
        uint256 startingPrice = (currPrice * priceBuffer) / ONE;
        uint256 auctionId = auctionCount++;
        auctions[auctionId] = Auction(
            collId,
            lotSize,
            debtSize,
            owner,
            beneficiary,
            startingPrice,
            block.timestamp,
            false
        );

        emit AuctionStarted(collId, auctionId, lotSize);
    }

    function placeBid(
        uint256 auctionId,
        uint256 bidPrice,
        uint256 bidLot
    ) external {
        require(!auctions[auctionId].isOver, "Auctioneer/placeBid: Auction is over");
        // @todo re-evaluate why user shouldn't be able to place two bids
        require(bids[auctionId][msg.sender].price == 0, "Auctioneer/placeBid: this user has already placed a bid");

        (uint256 totalBidValue, uint256 totalBidLot, address indexToAdd) = totalBidValueAtPrice(auctionId, bidPrice);
        //        console.log("bidPrice Value      : %s", bidPrice * ONE);
        //        console.log("totalBidValue       : %s", totalBidValue);
        //        console.log("totalBidLot         : %s", totalBidLot);
        //        console.log("debt left           : %s", auctions[auctionId].debt);
        uint256 bidAbleAmount = auctions[auctionId].debt - totalBidValue;
        uint256 bidAbleLot = auctions[auctionId].lot - totalBidLot;
        uint256 bidAmount = bidPrice * bidLot;
        if (bidAbleAmount < bidAmount) {
            bidLot = min(bidAbleAmount / bidPrice, bidAbleLot);
            bidAmount = bidLot * bidPrice;
        }

        vaultEngine.moveStablecoin(msg.sender, address(this), bidAmount);
        //        console.log('indexToAdd        : %s', indexToAdd);

        nextHighestBidder[auctionId][msg.sender] = nextHighestBidder[auctionId][indexToAdd];
        nextHighestBidder[auctionId][indexToAdd] = msg.sender;
        bids[auctionId][msg.sender] = Bid(bidPrice, bidLot);

        emit BidPlaced(auctions[auctionId].collId, auctionId, msg.sender, bidPrice, bidLot);
        cancelOldBids(auctionId, totalBidValue, totalBidLot, indexToAdd);
    }

    function buyItNow(
        uint256 auctionId,
        uint256 maxPrice,
        uint256 lot
    ) external {
        require(!auctions[auctionId].isOver, "Auctioneer/buyItNow: Auction is over");
        // fail if currentPrice <= max Price
        uint256 currentPrice = calculatePrice(auctionId);
        require(currentPrice <= maxPrice, "Auctioneer/buyItNow: current price is higher than max price");
        require(currentPrice != 0, "Auctioneer/buyItNow: Current Price is now 0");
        uint256 buyableAmount = lot * currentPrice;

        (uint256 bidValueAtCurrent, uint256 totalBidLot, address index) = totalBidValueAtPrice(auctionId, currentPrice);
        //        console.log("bidValueAtCurrent     : %s", bidValueAtCurrent);
        //        console.log("debt                  : %s", auctions[auctionId].debt);
        //        console.log("totalBidLot           : %s", totalBidLot);
        //        console.log("lot                   : %s", auctions[auctionId].lot);

        require(
            bidValueAtCurrent < auctions[auctionId].debt && totalBidLot < auctions[auctionId].lot,
            "Auctioneer/buyItNow: Price has reach a point where BuyItNow is no longer available"
        );
        if (bidValueAtCurrent + buyableAmount > auctions[auctionId].debt) {
            buyableAmount = auctions[auctionId].debt - bidValueAtCurrent;
        }

        // @todo lotToBuy could be zero if buyableAmount < currentPrice
        uint256 lotToBuy = buyableAmount / currentPrice;

        lotToBuy = min(lotToBuy, auctions[auctionId].lot);
        buyableAmount = lotToBuy * currentPrice;

        //        console.log("buyableAmount        : %s ", lot);
        //        console.log("buyableAmount        : %s ", buyableAmount);
        //        console.log("lotToBuy             : %s ", lotToBuy);
        //        console.log("lot                  : %s ", auctions[auctionId].lot);

        vaultEngine.moveStablecoin(msg.sender, auctions[auctionId].beneficiary, lotToBuy * currentPrice);
        vaultEngine.moveCollateral(auctions[auctionId].collId, address(this), msg.sender, lotToBuy);

        auctions[auctionId].debt = auctions[auctionId].debt - buyableAmount;
        auctions[auctionId].lot = auctions[auctionId].lot - lotToBuy;
        //        console.log("debt                 : %s ", auctions[auctionId].debt);
        //        console.log("lot                  : %s ", auctions[auctionId].lot);
        checkIfAuctionEnded(auctionId);
        emit Sale(auctions[auctionId].collId, auctionId, msg.sender, currentPrice, lotToBuy);
        // starting lot and startingValue is 0
        cancelOldBids(auctionId, 0, 0, index);
    }

    function finalizeSale(uint256 auctionId) public {
        //        console.log("price               : %s", calculatePrice(auctionId));
        //        console.log("price with ratio    : %s", calculatePrice(auctionId) * nextBidRatio);
        //        console.log("bid price           : %s", bids[auctionId][msg.sender].price * ONE);
        require(bids[auctionId][msg.sender].price != 0, "Auctioneer/finalizeSale: The caller has no active bids");
        require(
            (calculatePrice(auctionId) * nextBidRatio) / ONE <= bids[auctionId][msg.sender].price,
            "Auctioneer/finalizeSale: the current price has not passed the bid price"
        );
        uint256 buyAmount = bids[auctionId][msg.sender].price * bids[auctionId][msg.sender].lot;

        vaultEngine.moveCollateral(
            auctions[auctionId].collId,
            address(this),
            msg.sender,
            bids[auctionId][msg.sender].lot
        );

        auctions[auctionId].debt -= buyAmount;
        auctions[auctionId].lot -= bids[auctionId][msg.sender].lot;

        removeIndex(auctionId, msg.sender);
        emit Sale(
            auctions[auctionId].collId,
            auctionId,
            msg.sender,
            bids[auctionId][msg.sender].price,
            bids[auctionId][msg.sender].lot
        );
        checkIfAuctionEnded(auctionId);
    }

    function calculatePrice(uint256 auctionId) public returns (uint256 price) {
        return priceCalc.price(auctions[auctionId].startPrice, block.timestamp - auctions[auctionId].startTime);
    }

    function cancelAuction(uint256 auctionId, address recipient) external onlyByProbity {
        Auction storage auction = auctions[auctionId];

        cancelOldBids(auctionId, auction.debt, auction.lot, HEAD);
        // accept the debt?
        liquidator.reduceAuctionDebt(auction.debt);
        vaultEngine.moveCollateral(auction.collId, address(this), recipient, auction.lot);

        auction.debt = 0;
        auction.lot = 0;
    }

    function totalBidValueAtPrice(uint256 auctionId, uint256 cutOffPrice)
        public
        view
        returns (
            uint256 totalBidsValue,
            uint256 totalLot,
            address prev
        )
    {
        if (nextHighestBidder[auctionId][HEAD] == address(0)) {
            return (totalBidsValue, totalLot, HEAD);
        }
        //        console.log('totalBidValueAtPrice');
        prev = HEAD;
        address index = nextHighestBidder[auctionId][HEAD];

        while (true) {
            //            console.log('next bidder          : %s', index);
            //            console.log('next bidder price    : %s', bids[auctionId][index].price);
            //            console.log('current BidPrice     : %s', cutOffPrice);
            //            console.log("total Lot            : %s", totalLot);
            //            console.log("totalBidValue        : %s", totalBidsValue);
            //            console.log('next Bid Ratio       : %s', bids[auctionId][index].price * nextBidRatio / ONE);
            if ((bids[auctionId][index].price * nextBidRatio) / ONE < cutOffPrice) {
                break;
            }
            totalLot += bids[auctionId][index].lot;
            totalBidsValue += (bids[auctionId][index].lot * bids[auctionId][index].price);
            prev = index;

            if (nextHighestBidder[auctionId][index] == address(0)) {
                break;
            }
            index = nextHighestBidder[auctionId][index];
        }
        //        console.log('index          : %s', index);
        //        console.log('');
        return (totalBidsValue, totalLot, prev);
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    function checkIfAuctionEnded(uint256 auctionId) internal {
        if (auctions[auctionId].debt == 0 || auctions[auctionId].lot == 0) {
            auctions[auctionId].isOver = true;

            auctions[auctionId].lot = 0;

            vaultEngine.moveCollateral(
                auctions[auctionId].collId,
                address(this),
                auctions[auctionId].owner,
                auctions[auctionId].lot
            );

            emit AuctionEnded(auctions[auctionId].collId, auctionId);
            return;
        }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a > b) {
            return b;
        } else {
            return a;
        }
    }

    function cancelOldBids(
        uint256 auctionId,
        uint256 startingValue,
        uint256 startingLot,
        address prev
    ) internal {
        //        console.log("prev                 : %s", prev);
        //        console.log("total Lot            : %s", startingLot);
        //        console.log("totalBidValue        : %s", startingValue);

        address index = nextHighestBidder[auctionId][prev];
        uint256 amountLeft = auctions[auctionId].debt - startingValue;
        uint256 lotLeft = auctions[auctionId].lot - startingLot;

        //        console.log("auction Debt         : %s", auctions[auctionId].debt);
        //        console.log("auction lot          : %s", auctions[auctionId].lot);

        //                console.log('there');
        while (true) {
            //            console.log("");
            //            console.log("amount Left          : %s", amountLeft);
            //            console.log("lot Left             : %s", lotLeft);
            uint256 bidPrice = bids[auctionId][index].price;
            uint256 bidLot = bids[auctionId][index].lot;
            //            console.log("bidPrice             : %s", bidPrice);
            //            console.log("bidLot               : %s", bidLot);
            //            console.log("bidValue             : %s", bidPrice * bidLot);
            if (bidPrice * bidLot <= amountLeft && bidLot <= lotLeft) {
                // we don't need to remove these as they are still valid
                amountLeft -= bidPrice * ONE;
                lotLeft -= bidLot;
            } else if (amountLeft > 0) {
                //                console.log('here');
                uint256 buyableLot = (amountLeft / bidPrice);
                //                console.log("buyableLot           : %s", buyableLot);
                //                console.log("lot Left             : %s", lotLeft);
                buyableLot = min(lotLeft, buyableLot);
                //                console.log("buyableLot           : %s", buyableLot);
                if (buyableLot < bidLot) {
                    // this bidder's lot is going to change to amountLeftOver
                    uint256 lotDiff = bidLot - buyableLot;
                    //                    console.log("lotDiff              : %s", lotDiff);
                    bids[auctionId][index].lot = buyableLot;
                    //                    console.log("amount To Return     : %s", lotDiff * bidPrice);
                    vaultEngine.moveStablecoin(address(this), index, lotDiff * bidPrice);
                }

                if (bids[auctionId][index].lot == 0) {
                    bids[auctionId][index].price = 0;
                }

                emit BidModified(
                    auctions[auctionId].collId,
                    auctionId,
                    msg.sender,
                    bidPrice,
                    bidLot - buyableLot,
                    buyableLot
                );

                lotLeft -= buyableLot;
                amountLeft -= buyableLot * bidPrice;
            } else {
                // amount left == 0, we remove the bidder and return the funds
                vaultEngine.moveStablecoin(address(this), index, bidLot * bidPrice);
                // remove the index from the nextHighestBidder and reset the bids to zero
                emit BidRemoved(
                    auctions[auctionId].collId,
                    auctionId,
                    msg.sender,
                    bids[auctionId][index].price,
                    bids[auctionId][index].lot
                );
                bids[auctionId][index].lot = 0;
                bids[auctionId][index].price = 0;

                // set prev -> index.next
                nextHighestBidder[auctionId][prev] = nextHighestBidder[auctionId][index];
                // set index.next = zero
                nextHighestBidder[auctionId][index] = address(0);

                index = prev;
            }

            if (nextHighestBidder[auctionId][index] == address(0)) {
                break;
            }
            prev = index;
            index = nextHighestBidder[auctionId][index];
        }
    }

    function removeIndex(uint256 auctionId, address indexToRemove) internal {
        bool removed = false;
        address index = HEAD;
        while (index != address(0)) {
            if (nextHighestBidder[auctionId][index] == indexToRemove) {
                nextHighestBidder[auctionId][index] = nextHighestBidder[auctionId][indexToRemove];
                nextHighestBidder[auctionId][indexToRemove] = address(0);
                removed = true;
            }

            index = nextHighestBidder[auctionId][index];
        }
        require(removed, "Auctioneer/removeIndex: The index could not be found");
    }
}
