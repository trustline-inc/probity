// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function vaults(bytes32 collId, address user)
        external
        returns (
            uint256 standbyCollateralAmount,
            uint256 activeCollateralAmount,
            uint256 debt,
            uint256 equity
        );

    function assetTypes(bytes32 collId)
        external
        returns (
            uint256 debtAccumulator,
            uint256 equityAccumulator,
            uint256 adjustedPrice
        );

    function liquidateVault(
        bytes32 collId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount,
        int256 equityAmount
    ) external;
}

interface AuctioneerLike {
    function startAuction(
        bytes32 collId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary
    ) external;
}

interface ReservePoolLike {
    function addAuctionDebt(uint256 newDebt) external;

    function reduceAuctionDebt(uint256 debtToReduce) external;
}

// When a vault is liquidated, the reserve pool will take the on the debt and
// attempt to sell it thru the auction the auction will attempt to sell the collateral to raise
// 'debt + liquidation penalty' the excess collateral will be return to the original vault owner
// surplus from the sales will be sent to the reserve pool,
// and when there are debt, reserve pool will be used to pay off the debt
// if there are no reserve in the pool to pay off the debt, there will be a debt auction
// which will sell IOUs which can be redeemed as the pool is replenished
contract Liquidator is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////
    struct Collateral {
        AuctioneerLike auctioneer;
        uint256 debtPenaltyFee;
        uint256 equityPenaltyFee;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant PRECISION_PRICE = 10**27;
    uint256 private constant PRECISION_COLL = 10**18;

    VaultEngineLike public immutable vaultEngine;
    ReservePoolLike public immutable reserve;

    mapping(bytes32 => Collateral) public collateralTypes;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        ReservePoolLike reservePoolAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        reserve = reservePoolAddress;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////
    function init(bytes32 collId, AuctioneerLike auctioneer) external onlyBy("gov") {
        collateralTypes[collId].auctioneer = auctioneer;
        collateralTypes[collId].debtPenaltyFee = 1.17E18;
        collateralTypes[collId].equityPenaltyFee = 1.05E18;
    }

    function updatePenalties(
        bytes32 collId,
        uint256 debtPenalty,
        uint256 equityPenalty
    ) external onlyBy("gov") {
        emit LogVarUpdate("liquidator", collId, "debtPenaltyFee", collateralTypes[collId].debtPenaltyFee, debtPenalty);
        emit LogVarUpdate(
            "liquidator",
            collId,
            "equityPenaltyFee",
            collateralTypes[collId].equityPenaltyFee,
            equityPenalty
        );

        collateralTypes[collId].debtPenaltyFee = debtPenalty;
        collateralTypes[collId].equityPenaltyFee = equityPenalty;
    }

    function updateAuctioneer(bytes32 collId, AuctioneerLike newAuctioneer) external onlyBy("gov") {
        emit LogVarUpdate(
            "adjustedPriceFeed",
            collId,
            "auctioneer",
            address(collateralTypes[collId].auctioneer),
            address(newAuctioneer)
        );
        collateralTypes[collId].auctioneer = newAuctioneer;
    }

    function reduceAuctionDebt(uint256 amount) external {
        reserve.reduceAuctionDebt(amount);
    }

    function liquidateVault(bytes32 collId, address user) external {
        // check if vault can be liquidated
        (uint256 debtAccumulator, uint256 equityAccumulator, uint256 adjustedPrice) = vaultEngine.assetTypes(collId);
        (, uint256 lockedColl, uint256 debt, uint256 equity) = vaultEngine.vaults(collId, user);

        require(lockedColl != 0 && debt + equity != 0, "Lidquidator: Nothing to liquidate");

        require(
            lockedColl * adjustedPrice < debt * debtAccumulator + equity * PRECISION_PRICE,
            "Liquidator: Vault collateral is still above required minimal ratio"
        );

        // transfer the debt to reservePool
        reserve.addAuctionDebt(((debt + equity) * PRECISION_PRICE));
        vaultEngine.liquidateVault(
            collId,
            user,
            address(collateralTypes[collId].auctioneer),
            address(reserve),
            -int256(lockedColl),
            -int256(debt),
            -int256(equity)
        );

        uint256 aurToRaise = (debt * debtAccumulator * collateralTypes[collId].debtPenaltyFee) /
            PRECISION_COLL +
            (equity * equityAccumulator * collateralTypes[collId].equityPenaltyFee) /
            PRECISION_COLL;
        // start the auction
        collateralTypes[collId].auctioneer.startAuction(collId, lockedColl, aurToRaise, user, address(reserve));
    }
}
