// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";

interface VaultEngineLike {
    function moveAsset(
        bytes32 collateral,
        address from,
        address to,
        uint256 amount
    ) external;

    function moveSystemCurrency(
        address from,
        address to,
        uint256 amount
    ) external;
}

interface VPAssetManagerLike {
    function collectRewardForUser(address user) external;
}

interface PriceCalc {
    function price(uint256 startPrice, uint256 timeElapsed) external returns (uint256 calculatedPrice);
}

interface PriceFeedLike {
    function getPrice(bytes32 assetId) external returns (uint256 _price);
}

interface LiquidatorLike {
    function reduceAuctionDebt(uint256 amount) external;
}

/**
 * @title Auctioneer contract
 * @notice Auctioneer will auction off the asset in exchange for the systemCurrency
 */

contract Auctioneer is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////

    struct Auction {
        bytes32 assetId;
        uint256 lot; // [WAD]
        uint256 debt; // [RAD]
        address owner; // leftover collateral will go back to this owner
        address beneficiary; // systemCurrency will go to this address
        uint256 startPrice;
        uint256 startTime;
        // should be zero if the asset doesn't have delegatable module implemented
        VPAssetManagerLike vpAssetManagerAddress;
        bool sellAllLot; // if true, debt amount doesn't matter, auction will attempt to sell until lot is zero
        bool isOver;
    }

    struct Bid {
        uint256 price; // [RAY]
        uint256 lot; // [WAD]
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1.00E18;
    uint256 private constant RAY = 1e27;
    address public constant HEAD = address(1);

    VaultEngineLike public immutable vaultEngine;
    PriceFeedLike public immutable priceFeed;
    LiquidatorLike public liquidator;
    PriceCalc public immutable priceCalc;

    uint256 public totalAuctions;
    uint256 public nextBidRatio = 1.03E18; // the next bid must be 103% of current bid or higher
    uint256 public priceBuffer = 1.10E18; // buffer to starting price, 110% of current price
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => Bid)) public bids; // auctionId -> user address -> bid
    mapping(uint256 => mapping(address => address)) public nextHighestBidder; // sorted linked list of bidders

    /////////////////////////////////////////
    // Modifiers
    /////////////////////////////////////////

    modifier onlyIfAuctionNotOver(uint256 auctionId) {
        if (auctions[auctionId].isOver) revert auctionIsOver();
        _;
    }

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event AuctionStarted(bytes32 indexed assetId, uint256 indexed auctionId, uint256 lotSize);
    event AuctionReset(bytes32 indexed assetId, uint256 indexed auctionId, uint256 lotSize);

    event BidPlaced(
        bytes32 indexed assetId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 lotSize
    );

    event Sale(
        bytes32 indexed assetId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 lotSize
    );

    event BidRemoved(
        bytes32 indexed assetId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 lotSize
    );

    event BidModified(
        bytes32 indexed assetId,
        uint256 indexed auctionId,
        address indexed user,
        uint256 price,
        uint256 oldLotSize,
        uint256 newLotSize
    );

    event AuctionEnded(bytes32 indexed assetId, uint256 indexed auctionId);

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error auctionIsOver();
    error userBidAlreadyExists();
    error userBidDoesNotExists();
    error resetCriteriaNotMet();
    error currentPriceIsHigherThanMaxPrice();
    error currentPriceIsZero();
    error buyItNowNoLongerAvailable();
    error currentPriceIsNotYetBelowBidPrice();
    error bidderIndexNotFound();

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        PriceCalc priceCalcAddress,
        PriceFeedLike priceFeedAddress,
        LiquidatorLike liquidatorAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        priceCalc = priceCalcAddress;
        priceFeed = priceFeedAddress;
        liquidator = liquidatorAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @notice Starts an asset auction
     * @param assetId The ID of the collateral on auction
     * @param lotSize The size of the lot
     * @param debtSize The amount of systemCurrency that need to be raised
     * @param owner The owner of the liquidated vault
     * @param beneficiary A ReservePool address
     * @param sellAllLot if true, sell all the asset regardless of the debt size needed to raise
     */
    function startAuction(
        bytes32 assetId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary,
        VPAssetManagerLike vpAssetManagerAddress,
        bool sellAllLot
    ) external onlyBy("liquidator") {
        uint256 currentPrice = priceFeed.getPrice(assetId);
        uint256 startPrice = (currentPrice * priceBuffer) / ONE;
        uint256 auctionId = totalAuctions++;
        auctions[auctionId] = Auction(
            assetId,
            lotSize,
            debtSize,
            owner,
            beneficiary,
            startPrice,
            block.timestamp,
            vpAssetManagerAddress,
            sellAllLot,
            false
        );

        emit AuctionStarted(assetId, auctionId, lotSize);
    }

    /**
     * @notice Reset the auction if it is over and there are still lots to be sold
     * @param auctionId The ID of the auction to reset
     */
    function resetAuction(uint256 auctionId) external onlyIfAuctionNotOver(auctionId) {
        Auction storage auction = auctions[auctionId];
        if (calculatePrice(auctionId) != 0 || auction.startTime == 0 || auction.lot == 0) revert resetCriteriaNotMet();

        uint256 currentPrice = priceFeed.getPrice(auctions[auctionId].assetId);
        uint256 startPrice = (currentPrice * priceBuffer) / ONE;
        auction.startPrice = startPrice;
        auction.startTime = block.timestamp;

        emit AuctionReset(auction.assetId, auctionId, auction.lot);
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
    ) external onlyIfAuctionNotOver(auctionId) onlyWhen("paused", false) {
        if (bids[auctionId][msg.sender].price != 0) revert userBidAlreadyExists();

        (uint256 biddableLot, uint256 totalBidValue, uint256 totalBidLot, address indexToAdd) = getBiddableLot(
            auctionId,
            bidPrice,
            bidLot
        );

        biddableLot = Math._min(bidLot, biddableLot);
        uint256 bidValue = biddableLot * bidPrice;

        vaultEngine.moveSystemCurrency(msg.sender, address(this), bidValue);

        nextHighestBidder[auctionId][msg.sender] = nextHighestBidder[auctionId][indexToAdd];
        nextHighestBidder[auctionId][indexToAdd] = msg.sender;
        bids[auctionId][msg.sender] = Bid(bidPrice, biddableLot);

        emit BidPlaced(auctions[auctionId].assetId, auctionId, msg.sender, bidPrice, bidLot);
        _cancelOldBids(auctionId, totalBidValue, totalBidLot, indexToAdd);
    }

    /**
     * @notice cancel the existing bid on an auction
     * @param auctionId The ID of the auction
     */
    function cancelBid(uint256 auctionId) external {
        if (bids[auctionId][msg.sender].price == 0) revert userBidDoesNotExists();

        address prev = HEAD;
        while (nextHighestBidder[auctionId][prev] != address(0)) {
            if (nextHighestBidder[auctionId][prev] == msg.sender) {
                break;
            }
            prev = nextHighestBidder[auctionId][prev];
        }

        _removeBid(auctionId, msg.sender, prev);
    }

    /**
     * @notice Allows a user to purchase collateral outright as long as the current Price is less than maxPrice
     * @param auctionId The ID of the auction
     * @param maxPrice Max price the buyer is willing to pay for the lot
     * @param lot The amount of collateral to purchase
     */
    function buyItNow(
        uint256 auctionId,
        uint256 maxPrice,
        uint256 lot
    ) external onlyIfAuctionNotOver(auctionId) onlyWhen("paused", false) {
        Auction memory auction = auctions[auctionId];
        uint256 currentPrice = calculatePrice(auctionId);
        if (currentPrice > maxPrice) revert currentPriceIsHigherThanMaxPrice();
        if (currentPrice == 0) revert currentPriceIsZero();
        uint256 lotValue = lot * currentPrice;

        (uint256 biddableLot, , , ) = getBiddableLot(auctionId, currentPrice, lot);
        if (biddableLot == 0) revert buyItNowNoLongerAvailable();

        uint256 lotToBuy = Math._min(lot, biddableLot);
        lotValue = lotToBuy * currentPrice;
        vaultEngine.moveSystemCurrency(msg.sender, auctions[auctionId].beneficiary, lotValue);

        if (address(auction.vpAssetManagerAddress) != address(0)) {
            auction.vpAssetManagerAddress.collectRewardForUser(msg.sender);
        }

        vaultEngine.moveAsset(auctions[auctionId].assetId, address(this), msg.sender, lotToBuy);

        if (!auction.sellAllLot) {
            auctions[auctionId].debt = auctions[auctionId].debt - lotValue;
        }

        auctions[auctionId].lot = auctions[auctionId].lot - lotToBuy;
        if (!auctions[auctionId].sellAllLot) {
            liquidator.reduceAuctionDebt(lotValue);
        }

        _endAuction(auctionId);
        emit Sale(auctions[auctionId].assetId, auctionId, msg.sender, currentPrice, lotToBuy);
        _cancelOldBids(auctionId, 0, 0, HEAD);
    }

    /**
     * @notice Finalize a sale for a bid if the current price is at or below the bid price
     * @param auctionId The ID of the auction to finalize
     */
    function finalizeSale(uint256 auctionId) public onlyWhen("paused", false) {
        if (bids[auctionId][msg.sender].price == 0) revert userBidDoesNotExists();
        if ((calculatePrice(auctionId) * nextBidRatio) / ONE > bids[auctionId][msg.sender].price)
            revert currentPriceIsNotYetBelowBidPrice();
        uint256 buyAmount = bids[auctionId][msg.sender].price * bids[auctionId][msg.sender].lot;

        if (address(auctions[auctionId].vpAssetManagerAddress) != address(0)) {
            auctions[auctionId].vpAssetManagerAddress.collectRewardForUser(msg.sender);
        }
        vaultEngine.moveAsset(auctions[auctionId].assetId, address(this), msg.sender, bids[auctionId][msg.sender].lot);

        if (!auctions[auctionId].sellAllLot) {
            auctions[auctionId].debt -= buyAmount;
        }

        auctions[auctionId].lot -= bids[auctionId][msg.sender].lot;

        _removeIndex(auctionId, msg.sender);
        emit Sale(
            auctions[auctionId].assetId,
            auctionId,
            msg.sender,
            bids[auctionId][msg.sender].price,
            bids[auctionId][msg.sender].lot
        );

        if (!auctions[auctionId].sellAllLot) {
            liquidator.reduceAuctionDebt(buyAmount);
        }

        _endAuction(auctionId);
    }

    /**
     * @notice get current biddable lot and amount based on existing bids and current price
     * @param auctionId The ID of the auction
     */
    function getBiddableLot(
        uint256 auctionId,
        uint256 bidPrice,
        uint256 bidLot
    )
        public
        view
        returns (
            uint256 biddableLot,
            uint256 totalBidValue,
            uint256 totalBidLot,
            address indexToAdd
        )
    {
        Auction memory auction = auctions[auctionId];

        address index;
        (totalBidValue, totalBidLot, index) = totalBidValueAtPrice(auctionId, bidPrice);

        if (auction.sellAllLot) {
            biddableLot = auction.lot - totalBidLot;
            return (biddableLot, totalBidValue, totalBidLot, index);
        }

        uint256 biddableValue = auction.debt - totalBidValue;
        biddableLot = auction.lot - totalBidLot;

        if (biddableValue < bidPrice * bidLot) {
            biddableLot = Math._min(biddableValue / bidPrice, biddableLot);
        }

        return (biddableLot, totalBidValue, totalBidLot, index);
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
     * @dev Only callable by Probity
     * @param auctionId The ID of the auction to cancel
     * @param recipient The address of the recipient (e.g., ReservePool)
     */
    function cancelAuction(uint256 auctionId, address recipient) external onlyByProbity {
        Auction storage auction = auctions[auctionId];

        _cancelOldBids(auctionId, auction.debt, auction.lot, HEAD);

        liquidator.reduceAuctionDebt(auction.debt);
        vaultEngine.moveAsset(auction.assetId, address(this), recipient, auction.lot);

        auction.debt = 0;
        auction.lot = 0;
    }

    /**
     * @notice Cycles through the nextHighestBidder list to calculate the total value of the bids at a certain price
     * @param auctionId The ID of the auction
     * @param price to stop at
     */
    function totalBidValueAtPrice(uint256 auctionId, uint256 price)
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
            if ((bids[auctionId][index].price * nextBidRatio) / ONE < price) {
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
    function _endAuction(uint256 auctionId) internal {
        Auction storage auction = auctions[auctionId];

        if (auction.lot == 0 || (auction.debt == 0 && !auction.sellAllLot)) {
            // auction is ended for sure
            auction.isOver = true;

            if (!auction.sellAllLot) {
                if (auction.debt > 0) {
                    liquidator.reduceAuctionDebt(auction.debt);
                }

                if (auction.lot > 0) {
                    vaultEngine.moveAsset(auction.assetId, address(this), auction.owner, auction.lot);
                }
                auction.lot = 0;
                auction.debt = 0;
            }

            emit AuctionEnded(auction.assetId, auctionId);
            return;
        }
    }

    /**
     * @notice Cancel bids that are no longer in contention based on new bids or sales
     * @param auctionId The ID of the auction to cancel old bids for
     * @param startingValue allow the function to start at a predetermined value instead of looping from beginning
     * @param startingLot allow the function to start at a predetermined lot instead of looping from beginning
     * @param prev address of the bidder in the linked list that holds the cumulative value and lot
     */
    function _cancelOldBids(
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

            if (auctions[auctionId].sellAllLot) {
                if (bidLot <= lotLeft) {
                    // we don't need to remove these as they are still valid
                    lotLeft -= bidLot;
                } else if (lotLeft > 0) {
                    // lotLeft > 0 && lotLeft < bidLot
                    _modifyBid(auctionId, index, lotLeft);
                    lotLeft = 0;
                } else {
                    // bidLeft left == 0, we remove the bidder and return the funds
                    _removeBid(auctionId, index, prev);
                    index = prev;
                }
            } else {
                if (bidPrice * bidLot <= amountLeft && bidLot <= lotLeft) {
                    // we don't need to remove these as they are still valid
                    amountLeft -= bidPrice * ONE;
                    lotLeft -= bidLot;
                } else if (amountLeft > 0) {
                    uint256 buyableLot = (amountLeft / bidPrice);
                    buyableLot = Math._min(lotLeft, buyableLot);
                    if (buyableLot < bidLot) {
                        _modifyBid(auctionId, index, buyableLot);
                    }

                    lotLeft -= buyableLot;
                    amountLeft -= buyableLot * bidPrice;
                } else {
                    // amount left == 0, we remove the bidder and return the funds
                    _removeBid(auctionId, index, prev);
                    index = prev;
                }
            }

            if (nextHighestBidder[auctionId][index] == address(0)) {
                break;
            }
            prev = index;
            index = nextHighestBidder[auctionId][index];
        }
    }

    /**
     * @notice Allow uer to change the current bid
     * @param auctionId The ID of the auction to cancel old bids for
     * @param bidder address of the bidder
     * @param newLot new lot value for bidder
     */
    function _modifyBid(
        uint256 auctionId,
        address bidder,
        uint256 newLot
    ) internal {
        vaultEngine.moveSystemCurrency(
            address(this),
            bidder,
            (bids[auctionId][bidder].lot - newLot) * bids[auctionId][bidder].price
        );
        bids[auctionId][bidder].lot = newLot;

        if (bids[auctionId][bidder].lot == 0) {
            bids[auctionId][bidder].price = 0;
        }

        emit BidModified(
            auctions[auctionId].assetId,
            auctionId,
            msg.sender,
            bids[auctionId][bidder].price,
            bids[auctionId][bidder].lot,
            newLot
        );
    }

    /**
     * @notice Remove an existing bid
     * @param auctionId The ID of the auction to cancel old bids for
     * @param bidder address of the bidder
     * @param prev index of the prev bidder in bids
     */
    function _removeBid(
        uint256 auctionId,
        address bidder,
        address prev
    ) internal {
        vaultEngine.moveSystemCurrency(
            address(this),
            bidder,
            bids[auctionId][bidder].lot * bids[auctionId][bidder].price
        );
        // remove the index from the nextHighestBidder and reset the bids to zero
        emit BidRemoved(
            auctions[auctionId].assetId,
            auctionId,
            msg.sender,
            bids[auctionId][bidder].price,
            bids[auctionId][bidder].lot
        );
        bids[auctionId][bidder].lot = 0;
        bids[auctionId][bidder].price = 0;

        // set prev -> index.next
        nextHighestBidder[auctionId][prev] = nextHighestBidder[auctionId][bidder];
        // set index.next = zero
        nextHighestBidder[auctionId][bidder] = address(0);
    }

    /**
     * @notice remove the bidder at index on the nextHighestBidder List
     * @param auctionId The ID of the auction
     * @param indexToRemove address of the bidder to remove from bids linked list
     */
    function _removeIndex(uint256 auctionId, address indexToRemove) internal {
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
        if (!removed) revert bidderIndexNotFound();
    }
}
