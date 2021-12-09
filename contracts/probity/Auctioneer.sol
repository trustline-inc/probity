// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

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
    address private constant HEAD = address(1);

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
    mapping(uint256 => uint256) public totalBidSize;
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
        uint256 lot
    ) external {
        require(!auctions[auctionId].isOver, "Auctioneer/placeBid: Auction is over");
        require(bids[auctionId][msg.sender].price == 0, "Auctioneer/placeBid: this user has already placed a bid");

        (uint256 totalBidValue, address index) = totalBidsAtPrice(auctionId, bidPrice * ONE);
        uint256 bidAbleAmount = auctions[auctionId].debt - totalBidValue;
        uint256 bidAmount = bidPrice * lot;
        if (bidAbleAmount < bidAmount) {
            lot = bidAbleAmount / bidPrice;
            bidAmount = bidAbleAmount;
        }

        vaultEngine.moveStablecoin(msg.sender, address(this), bidAmount);
        address indexToAdd = findIndex(auctionId, bidPrice);

        nextHighestBidder[auctionId][msg.sender] = nextHighestBidder[auctionId][indexToAdd];
        nextHighestBidder[auctionId][indexToAdd] = msg.sender;
        bids[auctionId][msg.sender] = Bid(bidPrice, lot);
        totalBidSize[auctionId] = totalBidSize[auctionId] + bidAmount;

        emit BidPlaced(auctions[auctionId].collId, auctionId, msg.sender, bidPrice, lot);
        cancelOldBids(auctionId, totalBidValue, index);
    }

    function buyItNow(
        uint256 auctionId,
        uint256 maxPrice,
        uint256 amount
    ) external {
        require(!auctions[auctionId].isOver, "Auctioneer/buyItNow: Auction is over");
        // fail if currentPrice <= max Price
        uint256 currentPrice = calculatePrice(auctionId);
        require(currentPrice <= maxPrice, "Auctioneer/buyItNow: current price is higher than max price");
        require(currentPrice != 0, "Auctioneer/buyItNow: Current Price is now 0");
        uint256 buyableAmount = amount;

        (uint256 bidValueAtCurrent, address index) = totalBidsAtPrice(auctionId, currentPrice * ONE);
        require(
            bidValueAtCurrent < auctions[auctionId].debt,
            "Auctioneer/buyItNow: Price has reach a point where BuyItNow is no longer available"
        );
        if (bidValueAtCurrent + amount > auctions[auctionId].debt) {
            buyableAmount = auctions[auctionId].debt - bidValueAtCurrent;
        }

        uint256 lotToBuy = buyableAmount / currentPrice;

        vaultEngine.moveStablecoin(msg.sender, auctions[auctionId].beneficiary, buyableAmount);
        vaultEngine.moveCollateral(auctions[auctionId].collId, address(this), msg.sender, lotToBuy);

        auctions[auctionId].debt = auctions[auctionId].debt - buyableAmount;
        auctions[auctionId].lot = auctions[auctionId].lot - lotToBuy;

        checkIfAuctionEnded(auctionId);
        emit Sale(auctions[auctionId].collId, auctionId, msg.sender, currentPrice, lotToBuy);
        cancelOldBids(auctionId, bidValueAtCurrent, index);
    }

    function finalizeSale(uint256 auctionId) public {
        require(
            calculatePrice(auctionId) * nextBidRatio >= bids[auctionId][msg.sender].price * ONE,
            "Auctioneer/finalizeSale: the current price has not passed the bid price"
        );
        uint256 buyAmount = bids[auctionId][msg.sender].price * bids[auctionId][msg.sender].lot;
        vaultEngine.moveStablecoin(msg.sender, auctions[auctionId].beneficiary, buyAmount);
        vaultEngine.moveCollateral(
            auctions[auctionId].collId,
            address(this),
            msg.sender,
            bids[auctionId][msg.sender].lot
        );

        auctions[auctionId].debt = auctions[auctionId].debt - buyAmount;
        auctions[auctionId].lot = auctions[auctionId].lot + bids[auctionId][msg.sender].lot;

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

    function checkIfAuctionEnded(uint256 auctionId) public {
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

    function calculatePrice(uint256 auctionId) public returns (uint256 price) {
        return priceCalc.price(auctions[auctionId].startPrice, block.timestamp - auctions[auctionId].startTime);
    }

    function removeIndex(uint256 auctionId, address indexToRemove) public {
        bool removed = false;
        address index = HEAD;
        while (index != address(0)) {
            if (nextHighestBidder[auctionId][index] == indexToRemove) {
                nextHighestBidder[auctionId][index] = nextHighestBidder[auctionId][indexToRemove];
                nextHighestBidder[auctionId][indexToRemove] = address(0);
                removed = true;
            }
        }
        require(removed, "Auctioneer/removeIndex: The index could not be found");
    }

    function findIndex(uint256 auctionId, uint256 newPrice) public view returns (address candidate) {
        candidate = HEAD;
        while (true) {
            if (verifyIndex(auctionId, candidate, newPrice, nextHighestBidder[auctionId][candidate])) return candidate;
            candidate = nextHighestBidder[auctionId][candidate];
        }
    }

    function cancelAuction(uint256 auctionId, address recipient) external {
        Auction storage auction = auctions[auctionId];
        // cancelOldBids at head index and currentBidValue should be at max?

        cancelOldBids(auctionId, 0, HEAD);
        // accept the debt?
        liquidator.reduceAuctionDebt(auction.debt);
        vaultEngine.moveCollateral(auction.collId, address(this), recipient, auction.lot);

        auction.debt = 0;
        auction.lot = 0;
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    function cancelOldBids(
        uint256 auctionId,
        uint256 startingValue,
        address prev
    ) internal {
        if (totalBidSize[auctionId] <= auctions[auctionId].debt) {
            return;
        }
        if (prev == address(0) || nextHighestBidder[auctionId][prev] == address(0)) {
            // there is nothing to remove since prev is already accounted for in startingValue
            return;
        }

        address index = nextHighestBidder[auctionId][prev];
        uint256 amountLeft = auctions[auctionId].debt - startingValue;

        while (true) {
            if (bids[auctionId][index].price * ONE <= amountLeft) {
                // we don't need to remove these as they are still valid
                amountLeft = amountLeft - bids[auctionId][index].price * ONE;
            } else if (amountLeft > 0) {
                // this bidder's lot is going to change to amountLeftOver
                uint256 lotDiff = bids[auctionId][index].lot - ((amountLeft / bids[auctionId][index].price) * ONE);
                bids[auctionId][index].lot = (amountLeft / bids[auctionId][index].price) * ONE;
                vaultEngine.moveStablecoin(address(this), index, lotDiff * bids[auctionId][index].price * ONE);

                amountLeft = 0;
            } else {
                // amount left == 0, we remove the bidder and return the funds
                vaultEngine.moveStablecoin(
                    address(this),
                    index,
                    bids[auctionId][index].lot * bids[auctionId][index].price * ONE
                );

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
            }

            if (nextHighestBidder[auctionId][index] == address(0)) {
                break;
            }
            prev = index;
            index = nextHighestBidder[auctionId][index];
        }
    }

    function totalBidsAtPrice(uint256 auctionId, uint256 cutOffPrice)
        internal
        view
        returns (uint256 totalBidsValue, address index)
    {
        if (nextHighestBidder[auctionId][HEAD] == address(0)) {
            return (totalBidsValue, index);
        }

        index = nextHighestBidder[auctionId][HEAD];

        while (true) {
            if (bids[auctionId][index].price * nextBidRatio < cutOffPrice) {
                break;
            }

            totalBidsValue = totalBidsValue + (bids[auctionId][index].lot * bids[auctionId][index].price);
            if (nextHighestBidder[auctionId][index] == address(0)) {
                break;
            }
            index = nextHighestBidder[auctionId][index];
        }

        return (totalBidsValue, index);
    }

    function verifyIndex(
        uint256 auctionId,
        address prev,
        uint256 newPrice,
        address next
    ) internal view returns (bool) {
        return
            (prev == HEAD || bids[auctionId][prev].price >= newPrice) &&
            (next == HEAD || newPrice > bids[auctionId][next].price);
    }
}
