// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function moveAsset(
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
    function price(uint256 startPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice);
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
        address owner; // leftover collateral will go back to this owner
        address beneficiary; // stablecoins will go to this address
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
    uint256 private constant RAY = 1e27;
    address public constant HEAD = address(1);

    VaultEngineLike public immutable vaultEngine;
    FtsoLike public immutable ftso;
    LiquidatorLike public liquidator;
    PriceCalc public immutable priceCalc;

    uint256 public auctionCount;
    // TODO: check and fix these values
    uint256 public nextBidRatio = 1.05E18;
    uint256 public priceBuffer = 1.20E18;
    // TODO: add smallest possible bid as to avoid tiny amounts
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => Bid)) public bids;
    // sorted linked list of bidders
    mapping(uint256 => mapping(address => address)) public nextHighestBidder;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event AuctionStarted(bytes32 indexed collId, uint256 indexed auctionId, uint256 lotSize);
    event AuctionReset(bytes32 indexed collId, uint256 indexed auctionId, uint256 lotSize);

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

    /**
     * @notice Starts a collateral auction
     * @param collId The ID of the collateral on auction
     * @param lotSize The size of the lot
     * @param debtSize The amount of stablecoins that need to be raised
     * @param owner The owner of the liquidated vault
     * @param beneficiary A ReservePool address
     */
    function startAuction(
        bytes32 collId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary
    ) external onlyBy("liquidator") {
        (uint256 currentPrice, ) = ftso.getCurrentPrice();
        uint256 startPrice = (rdiv(currentPrice, 1e5) * priceBuffer) / ONE;
        uint256 auctionId = auctionCount++;
        auctions[auctionId] = Auction(
            collId,
            lotSize,
            debtSize,
            owner,
            beneficiary,
            startPrice,
            block.timestamp,
            false
        );

        emit AuctionStarted(collId, auctionId, lotSize);
    }

    /**
     * @notice Reset the auction
     * @param auctionId The ID of the auction to reset
     */
    function resetAuction(uint256 auctionId) external {
        require(!auctions[auctionId].isOver, "Auctioneer/resetAuction: Auction is over");
        Auction storage auction = auctions[auctionId];
        require(
            calculatePrice(auctionId) == 0 && auction.startTime != 0,
            "Auctioneer/resetAuction: This auction isn't expired, or doesn't exist"
        );

        (uint256 currentPrice, ) = ftso.getCurrentPrice();
        uint256 startPrice = (rdiv(currentPrice, 1e5) * priceBuffer) / ONE;
        auction.startPrice = startPrice;
        auction.startTime = block.timestamp;

        emit AuctionReset(auction.collId, auctionId, auction.lot);
    }

    /**
     * @notice Place a bid on an auction
     * @param auctionId The ID of the auction
     * @param bidPrice The price of the bid
     * @param bidLot The lot size of the bid
     */
    function placeBid(
        uint256 auctionId,
        uint256 bidPrice,
        uint256 bidLot
    ) external {
        require(!auctions[auctionId].isOver, "Auctioneer/placeBid: Auction is over");
        // TODO: #235 re-evaluate why user shouldn't be able to place two bids
        require(bids[auctionId][msg.sender].price == 0, "Auctioneer/placeBid: This user has already placed a bid");

        (uint256 totalBidValue, uint256 totalBidLot, address indexToAdd) = totalBidValueAtPrice(auctionId, bidPrice);
        uint256 biddableAmount = auctions[auctionId].debt - totalBidValue;
        uint256 biddableLot = auctions[auctionId].lot - totalBidLot;
        uint256 bidAmount = bidPrice * bidLot;
        if (biddableAmount < bidAmount) {
            bidLot = min(biddableAmount / bidPrice, biddableLot);
            bidAmount = bidLot * bidPrice;
        }

        vaultEngine.moveStablecoin(msg.sender, address(this), bidAmount);

        nextHighestBidder[auctionId][msg.sender] = nextHighestBidder[auctionId][indexToAdd];
        nextHighestBidder[auctionId][indexToAdd] = msg.sender;
        bids[auctionId][msg.sender] = Bid(bidPrice, bidLot);

        emit BidPlaced(auctions[auctionId].collId, auctionId, msg.sender, bidPrice, bidLot);
        cancelOldBids(auctionId, totalBidValue, totalBidLot, indexToAdd);
    }

    /**
     * @notice Allows a user to purchase collateral outright
     * @param auctionId The ID of the auction
     * @param maxPrice TODO: where is this used?
     * @param lot The amount of collateral to purchase
     */
    function buyItNow(
        uint256 auctionId,
        uint256 maxPrice,
        uint256 lot
    ) external {
        require(!auctions[auctionId].isOver, "Auctioneer/buyItNow: Auction is over");
        uint256 currentPrice = calculatePrice(auctionId);
        require(currentPrice <= maxPrice, "Auctioneer/buyItNow: Current price is higher than max price");
        require(currentPrice != 0, "Auctioneer/buyItNow: Current price is now zero");
        uint256 buyableAmount = lot * currentPrice;

        (uint256 bidValueAtCurrent, uint256 totalBidLot, address index) = totalBidValueAtPrice(auctionId, currentPrice);
        require(
            bidValueAtCurrent < auctions[auctionId].debt && totalBidLot < auctions[auctionId].lot,
            "Auctioneer/buyItNow: Price has reach a point where BuyItNow is no longer available"
        );
        if (bidValueAtCurrent + buyableAmount > auctions[auctionId].debt) {
            buyableAmount = auctions[auctionId].debt - bidValueAtCurrent;
        }

        // TODO: lotToBuy could be zero if buyableAmount < currentPrice
        uint256 lotToBuy = buyableAmount / currentPrice;

        lotToBuy = min(lotToBuy, auctions[auctionId].lot);
        buyableAmount = lotToBuy * currentPrice;

        vaultEngine.moveStablecoin(msg.sender, auctions[auctionId].beneficiary, buyableAmount);
        vaultEngine.moveAsset(auctions[auctionId].collId, address(this), msg.sender, lotToBuy);

        auctions[auctionId].debt = auctions[auctionId].debt - buyableAmount;
        auctions[auctionId].lot = auctions[auctionId].lot - lotToBuy;

        endAuction(auctionId);
        emit Sale(auctions[auctionId].collId, auctionId, msg.sender, currentPrice, lotToBuy);
        cancelOldBids(auctionId, 0, 0, index);
    }

    /**
     * @notice TODO
     * @param auctionId The ID of the auction to finalize
     */
    function finalizeSale(uint256 auctionId) public {
        require(bids[auctionId][msg.sender].price != 0, "Auctioneer/finalizeSale: The caller has no active bids");
        require(
            (calculatePrice(auctionId) * nextBidRatio) / ONE <= bids[auctionId][msg.sender].price,
            "Auctioneer/finalizeSale: The current price has not passed the bid price"
        );
        uint256 buyAmount = bids[auctionId][msg.sender].price * bids[auctionId][msg.sender].lot;

        vaultEngine.moveAsset(auctions[auctionId].collId, address(this), msg.sender, bids[auctionId][msg.sender].lot);

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
        endAuction(auctionId);
    }

    /**
     * @notice Returns the current price of the given auction
     * @param auctionId The ID of the auction to check
     * @return price The current price of the auction
     */
    function calculatePrice(uint256 auctionId) public returns (uint256 price) {
        return priceCalc.price(auctions[auctionId].startPrice, block.timestamp - auctions[auctionId].startTime);
    }

    /**
     * @notice Cancels the auction
     * @dev Only callable by Probity during shutdown
     * @param auctionId The ID of the auction to cancel
     * @param recipient The address of the recipient (e.g., ReservePool)
     */
    function cancelAuction(uint256 auctionId, address recipient) external onlyByProbity {
        Auction storage auction = auctions[auctionId];

        cancelOldBids(auctionId, auction.debt, auction.lot, HEAD);
        // accept the debt?
        liquidator.reduceAuctionDebt(auction.debt);
        vaultEngine.moveAsset(auction.collId, address(this), recipient, auction.lot);

        auction.debt = 0;
        auction.lot = 0;
    }

    /**
     * @notice Cycles through the linked list to calculate the total value of the bids
     * @param auctionId The ID of the auction
     * @param cutOffPrice TODO
     */
    function totalBidValueAtPrice(uint256 auctionId, uint256 cutOffPrice)
        public
        view
        returns (
            uint256 totalBidValue,
            uint256 totalLot,
            address prev
        )
    {
        if (nextHighestBidder[auctionId][HEAD] == address(0)) {
            return (totalBidValue, totalLot, HEAD);
        }
        prev = HEAD;
        address index = nextHighestBidder[auctionId][HEAD];

        while (true) {
            if ((bids[auctionId][index].price * nextBidRatio) / ONE < cutOffPrice) {
                break;
            }
            totalLot += bids[auctionId][index].lot;
            totalBidValue += (bids[auctionId][index].lot * bids[auctionId][index].price);
            prev = index;

            if (nextHighestBidder[auctionId][index] == address(0)) {
                break;
            }
            index = nextHighestBidder[auctionId][index];
        }
        return (totalBidValue, totalLot, prev);
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    /**
     * @notice Ends an auction if it is done
     * @param auctionId The ID of the auction
     */
    function endAuction(uint256 auctionId) internal {
        if (auctions[auctionId].debt == 0 || auctions[auctionId].lot == 0) {
            auctions[auctionId].isOver = true;

            auctions[auctionId].lot = 0;

            vaultEngine.moveAsset(
                auctions[auctionId].collId,
                address(this),
                auctions[auctionId].owner,
                auctions[auctionId].lot
            );

            emit AuctionEnded(auctions[auctionId].collId, auctionId);
            return;
        }
    }

    /**
     * @notice TODO
     * @param auctionId The ID of the auction to cancel old bids for
     * @param startingValue TODO
     * @param startingLot TODO
     * @param prev TODO
     */
    function cancelOldBids(
        uint256 auctionId,
        uint256 startingValue,
        uint256 startingLot,
        address prev
    ) internal {
        address index = nextHighestBidder[auctionId][prev];
        uint256 amountLeft = auctions[auctionId].debt - startingValue;
        uint256 lotLeft = auctions[auctionId].lot - startingLot;

        while (true) {
            uint256 bidPrice = bids[auctionId][index].price;
            uint256 bidLot = bids[auctionId][index].lot;
            if (bidPrice * bidLot <= amountLeft && bidLot <= lotLeft) {
                // we don't need to remove these as they are still valid
                amountLeft -= bidPrice * ONE;
                lotLeft -= bidLot;
            } else if (amountLeft > 0) {
                uint256 buyableLot = (amountLeft / bidPrice);
                buyableLot = min(lotLeft, buyableLot);
                if (buyableLot < bidLot) {
                    uint256 lotDiff = bidLot - buyableLot;
                    bids[auctionId][index].lot = buyableLot;
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

    /**
     * @notice TODO
     * @param auctionId The ID of the auction
     * @param indexToRemove TODO
     */
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

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////

    function min(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a > b) {
            return b;
        } else {
            return a;
        }
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * RAY) + (y / 2)) / y;
    }
}
