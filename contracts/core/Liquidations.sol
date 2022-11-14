// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "../deps/Stateful.sol";
import "../deps/Eventful.sol";

interface VaultEngineLike {
    function vaults(
        bytes32 assetId,
        address user
    )
        external
        returns (
            uint256 standbyAmount,
            uint256 underlying,
            uint256 collateral,
            uint256 normDebt,
            uint256 normEquity,
            uint256 initialEquity,
            uint256 debtPrincipal
        );

    function rateForDebt() external returns (uint256 debtAccu);

    function assets(bytes32 assetId) external returns (uint256 adjustedPrice);

    function systemCurrency(address user) external returns (uint256);

    function removeSystemCurrency(address user, uint256 amount) external;

    function liquidateDebtPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount,
        int256 principalAmount
    ) external;

    function liquidateEquityPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        int256 assetToAuction,
        int256 assetToReturn,
        int256 equityAmount,
        int256 initialEquityAmount
    ) external;
}

interface AuctioneerLike {
    function startAuction(
        bytes32 assetId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary,
        address vpAssetManagerAddress,
        bool sellAllLot
    ) external;
}

interface ReservePoolLike {
    function addAuctionDebt(uint256 newDebt) external;

    function reduceAuctionDebt(uint256 debtToReduce) external;
}

interface PriceFeedLike {
    function getPrice(bytes32 assetId) external returns (uint256 price);
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
    struct Asset {
        AuctioneerLike auctioneer;
        address vpAssetManagerAddress; // address should be zero if asset doesn't have delegatable
        uint256 debtPenaltyFee; // [WAD]
        uint256 equityPenaltyFee; // [WAD]
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10 ** 27;
    uint256 private constant WAD = 10 ** 18;

    VaultEngineLike public immutable vaultEngine;
    ReservePoolLike public immutable reserve;
    PriceFeedLike public immutable priceFeed;

    address public immutable treasuryAddress;

    mapping(bytes32 => Asset) public assets;

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error assetAlreadyInitialized();
    error vaultIsEmpty();
    error positionsNotReadyForLiquidation();
    error insufficientFundsInTreasury();

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        ReservePoolLike reservePoolAddress,
        PriceFeedLike priceFeedAddress,
        address _treasuryAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        reserve = reservePoolAddress;
        priceFeed = priceFeedAddress;
        treasuryAddress = _treasuryAddress;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////
    /**
     * @notice Initialize new asset type
     * @param assetId The ID of the asset type
     * @param auctioneer The contract address of the auctioneer
     */
    function initAsset(bytes32 assetId, AuctioneerLike auctioneer, address vpAssetManager) external onlyBy("admin") {
        if (address(assets[assetId].auctioneer) != address(0)) revert assetAlreadyInitialized();

        assets[assetId].auctioneer = auctioneer;
        assets[assetId].vpAssetManagerAddress = vpAssetManager;
        assets[assetId].debtPenaltyFee = 1.7E17;
        assets[assetId].equityPenaltyFee = 5E16;
    }

    /**
     * @notice Updates liquidation penalties
     * @param assetId The ID of the collateral type
     * @param debtPenalty The new debt position penalty
     * @param equityPenalty The new equity position penalty
     */
    function updatePenalties(bytes32 assetId, uint256 debtPenalty, uint256 equityPenalty) external onlyBy("admin") {
        emit LogVarUpdate("liquidator", assetId, "debtPenaltyFee", assets[assetId].debtPenaltyFee, debtPenalty);
        emit LogVarUpdate("liquidator", assetId, "equityPenaltyFee", assets[assetId].equityPenaltyFee, equityPenalty);

        assets[assetId].debtPenaltyFee = debtPenalty;
        assets[assetId].equityPenaltyFee = equityPenalty;
    }

    /**
     * @notice Updates the address of the auctioneer contract used by Liquidator
     * @param assetId The ID of the collateral type
     * @param newAuctioneer The address of the new auctioneer
     */
    function updateAuctioneer(bytes32 assetId, AuctioneerLike newAuctioneer) external onlyBy("admin") {
        emit LogVarUpdate(
            "adjustedPriceFeed",
            assetId,
            "auctioneer",
            address(assets[assetId].auctioneer),
            address(newAuctioneer)
        );
        assets[assetId].auctioneer = newAuctioneer;
    }

    /**
     * @notice reduces debt that's currently on auction
     * @param amount The amount to reduce the ReservePool debt by
     */
    function reduceAuctionDebt(uint256 amount) external onlyBy("auctioneer") {
        reserve.reduceAuctionDebt(amount);
    }

    /**
     * @notice checks and liquidates an undercollateralized vault
     * @param assetId The ID of the collateral type
     * @param user The address of the vault to liquidate
     */
    function liquidateVault(bytes32 assetId, address user) external onlyWhen("paused", false) {
        uint256 rateForDebt = vaultEngine.rateForDebt();
        uint256 adjustedPrice = vaultEngine.assets(assetId);
        (
            ,
            uint256 underlying,
            uint256 collateral,
            uint256 debt,
            uint256 equity,
            uint256 initialEquity,
            uint256 debtPrincipal
        ) = vaultEngine.vaults(assetId, user);

        if ((underlying + collateral) == 0 || (debt + equity == 0)) revert vaultIsEmpty();

        if (collateral * adjustedPrice >= debt * rateForDebt && underlying * adjustedPrice >= initialEquity)
            revert positionsNotReadyForLiquidation();

        if (collateral * adjustedPrice < debt * rateForDebt) {
            _liquidateDebtPosition(assetId, user, collateral, debt, debtPrincipal, rateForDebt);
        }

        if (underlying * adjustedPrice < equity * RAY) {
            _liquidateEquityPosition(assetId, user, underlying, equity, initialEquity);
        }
    }

    ////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////

    function _liquidateDebtPosition(
        bytes32 assetId,
        address user,
        uint256 collateral,
        uint256 debt,
        uint256 debtPrincipal,
        uint256 rateForDebt
    ) internal {
        Asset memory asset = assets[assetId];
        // Transfer the debt to reserve pool
        reserve.addAuctionDebt(debt * RAY);
        vaultEngine.liquidateDebtPosition(
            assetId,
            user,
            address(asset.auctioneer),
            address(reserve),
            -int256(collateral),
            -int256(debt),
            -int256(debtPrincipal)
        );

        uint256 debtPosition = debt * rateForDebt;
        uint256 fundraiseTarget = debtPosition + ((debtPosition * assets[assetId].debtPenaltyFee) / WAD);

        asset.auctioneer.startAuction(
            assetId,
            collateral,
            fundraiseTarget,
            user,
            address(reserve),
            asset.vpAssetManagerAddress,
            false
        );
    }

    function _liquidateEquityPosition(
        bytes32 assetId,
        address user,
        uint256 underlying,
        uint256 equity,
        uint256 initialEquity
    ) internal {
        if (vaultEngine.systemCurrency(treasuryAddress) < equity) revert insufficientFundsInTreasury();

        Asset memory asset = assets[assetId];

        uint256 penaltyAmount = (initialEquity * asset.equityPenaltyFee) / WAD;
        uint256 assetToAuction = penaltyAmount / priceFeed.getPrice(assetId);
        uint256 assetToReturn;

        // if assetToAuction is more than underlying, auction all the remaining
        if (underlying <= assetToAuction) {
            assetToAuction = underlying;
        } else {
            assetToReturn = underlying - assetToAuction;
        }

        vaultEngine.liquidateEquityPosition(
            assetId,
            user,
            address(asset.auctioneer),
            -int256(assetToAuction),
            -int256(assetToReturn),
            -int256(equity),
            -int256(initialEquity)
        );

        assets[assetId].auctioneer.startAuction(
            assetId,
            assetToAuction,
            penaltyAmount,
            address(reserve),
            address(reserve),
            asset.vpAssetManagerAddress,
            true
        );

        vaultEngine.removeSystemCurrency(treasuryAddress, initialEquity);
    }
}
