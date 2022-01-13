// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "./Treasury.sol";
import "./priceFunction/LinearDecrease.sol";

/**
 * The shutdown module's main purpose is to pause functionality and
 * allow borrowers to redeem stablecoins for the remaining collateral
 * and allows investors to redeem underlying assets.
 *
 * Step 1: Pause all normal functionality
 * Step 2: Set final asset prices
 * Step 3: Allow users to withdraw excess assets from healthy vaults
 * Step 4: Allow auctions to finish (is this gonna take too long?)
 * Step 5: Calculate net +/- in reserve vs. system debt
 * Step 6: Calculate the net deficit in unhealthy vaults (can we do this earlier?)
 * Step 7: Calculate final asset per AUR = amount of asset in vault / total AUR in circulation
 */

interface PriceFeedLike {
    function setShutdownState() external;

    function getPrice(bytes32 assetId) external returns (uint256 price);
}

interface VaultLike {
    function setShutdownState() external;

    function stablecoin(address user) external returns (uint256 value);

    function unbackedDebt(address user) external returns (uint256 value);

    function totalDebt() external returns (uint256 value);

    function totalEquity() external returns (uint256 value);

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;

    function moveAsset(
        bytes32 assetId,
        address from,
        address to,
        uint256 amount
    ) external;

    function vaults(bytes32 assetId, address user)
        external
        returns (
            uint256 standbyAssetAmount,
            uint256 activeAssoutAmount,
            uint256 debt,
            uint256 equity,
            uint256 lastEquityAccumulator
        );

    function assets(bytes32 assetId)
        external
        returns (
            uint256 debtAccummulator,
            uint256 equityAccumulator,
            uint256 price,
            uint256 normDebt,
            uint256 normEquity,
            uint256 ceiling,
            uint256 floor
        );

    function liquidateVault(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collAmount,
        int256 debt,
        int256 equity
    ) external;
}

interface ReservePoolLike {
    function vouchers(address user) external returns (uint256 balance);

    function totalVouchers() external returns (uint256);

    function shutdownRedemption(address user, uint256 amount) external;

    function setShutdownState() external;
}

interface AuctioneerLike {
    function cancelAuction(uint256 auctionId, address recipient) external;

    function auctions(
        bytes32 assetId,
        uint256 lot,
        uint256 debt,
        address owner
    ) external;
}

interface TellerLike {
    function setShutdownState() external;
}

interface TreasuryLike {
    function setShutdownState() external;
}

interface LiquidatorLike {
    function assets(bytes32 assetId)
        external
        returns (
            address,
            uint256,
            uint256
        );

    function setShutdownState() external;
}

contract Shutdown is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////

    struct Collateral {
        uint256 finalPrice;
        uint256 normalizedDebt;
        uint256 gap;
        uint256 redemptionRatio;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////

    uint256 private constant RAY = 10**27;
    uint256 private constant WAD = 10**18;

    PriceFeedLike public priceFeed;
    VaultLike public vaultEngine;
    ReservePoolLike public reservePool;
    TellerLike public teller;
    TreasuryLike public treasury;
    LiquidatorLike public liquidator;

    bool public initiated;
    uint256 public initiatedAt;
    uint256 public auctionWaitPeriod = 2 days;
    uint256 public supplierWaitPeriod = 2 days;
    mapping(bytes32 => Collateral) public assets;
    mapping(bytes32 => mapping(address => uint256)) public collRedeemed;
    mapping(address => uint256) public stablecoin;
    uint256 public finalAurUtilizationRatio;
    uint256 public redemptionRatio;
    uint256 public aurGap; // value of under-collateralized vaults
    uint256 public supplierObligationRatio;
    uint256 public debt;
    uint256 public finalDebtBalance;
    uint256 public finalTotalReserve;

    /////////////////////////////////////////
    // Modifier
    /////////////////////////////////////////

    modifier onlyWhenInShutdown() {
        require(initiated, "Shutdown/onlyWhenInShutdown: Shutdown has not been initiated");
        _;
    }

    modifier onlyWhenNotInShutdown() {
        require(!initiated, "Shutdown/onlyWhenNotInShutdown: Shutdown has already been initiated");
        _;
    }

    modifier onlyIfFinalPriceSet(bytes32 assetId) {
        require(
            assets[assetId].finalPrice != 0,
            "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this assetId"
        );
        _;
    }

    /////////////////////////////////////////
    // Event
    /////////////////////////////////////////

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    constructor(
        address registryAddress,
        PriceFeedLike priceFeedAddress,
        VaultLike vaultAddress,
        ReservePoolLike reservePoolAddress,
        TellerLike tellerAddress,
        TreasuryLike treasuryAddress,
        LiquidatorLike liquidatorAddress
    ) Stateful(registryAddress) {
        priceFeed = priceFeedAddress;
        vaultEngine = vaultAddress;
        reservePool = reservePoolAddress;
        teller = tellerAddress;
        treasury = treasuryAddress;
        liquidator = liquidatorAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    function switchAddress(bytes32 which, address newAddress) external onlyWhenNotInShutdown onlyBy("gov") {
        if (which == "PriceFeed") {
            priceFeed = PriceFeedLike(newAddress);
        } else if (which == "VaultEngine") {
            vaultEngine = VaultLike(newAddress);
        } else if (which == "ReservePool") {
            reservePool = ReservePoolLike(newAddress);
        } else if (which == "Teller") {
            teller = TellerLike(newAddress);
        } else if (which == "Treasury") {
            treasury = TreasuryLike(newAddress);
        } else if (which == "Liquidator") {
            liquidator = LiquidatorLike(newAddress);
        } else {
            revert("shutdown/switchAddress: unknown which");
        }
    }

    function changeWaitPeriod(bytes32 which, uint256 newWaitPeriod) external onlyBy("gov") {
        if (which == "auctionWaitPeriod") {
            auctionWaitPeriod = newWaitPeriod;
        } else if (which == "supplierWaitPeriod") {
            supplierWaitPeriod = newWaitPeriod;
        } else {
            revert("shutdown/changeWaitPeriod: unknown which");
        }
    }

    // once a shutdown has been initiated, you can no longer cancel it.
    function initiateShutdown() external onlyWhenNotInShutdown onlyBy("gov") {
        initiated = true;
        initiatedAt = block.timestamp;

        this.setShutdownState();
        vaultEngine.setShutdownState();
        priceFeed.setShutdownState();
        teller.setShutdownState();
        treasury.setShutdownState();
        reservePool.setShutdownState();
        liquidator.setShutdownState();

        uint256 totalDebt = vaultEngine.totalDebt();
        uint256 totalEquity = vaultEngine.totalEquity();
        if (totalEquity != 0) {
            if (totalDebt >= totalEquity) {
                finalAurUtilizationRatio = RAY;
            } else {
                finalAurUtilizationRatio = wdiv(totalDebt, totalEquity);
            }
        }
    }

    // step 2: set final prices
    function setFinalPrice(bytes32 assetId) external onlyWhenInShutdown {
        uint256 price = priceFeed.getPrice(assetId);
        require(price != 0, "Shutdown/setFinalPrice: price retrieved is zero");

        (, , , assets[assetId].normalizedDebt, , , ) = vaultEngine.assets(assetId);

        assets[assetId].finalPrice = price;
    }

    /**
     * @notice Cancels outstanding debt, collects the appropriate amount of collateral, & frees excess collateral
     * @param assetId The ID of the vault asset
     * @param user The address of the vault user
     */
    function processUserDebt(bytes32 assetId, address user) external onlyIfFinalPriceSet(assetId) {
        (, uint256 activeAssetAmount, uint256 userDebt, , ) = vaultEngine.vaults(assetId, user);
        (uint256 debtAccummulator, , , , , , ) = vaultEngine.assets(assetId);

        uint256 collateral = (userDebt * debtAccummulator) / assets[assetId].finalPrice;
        uint256 amountToGrab = min(activeAssetAmount, collateral);
        uint256 gap = collateral - amountToGrab;
        assets[assetId].gap += gap;
        aurGap += gap * assets[assetId].finalPrice;

        vaultEngine.liquidateVault(
            assetId,
            user,
            address(this),
            address(this),
            -int256(amountToGrab),
            -int256(userDebt),
            0
        );
    }

    function freeExcessCollateral(bytes32 assetId, address user) external onlyIfFinalPriceSet(assetId) {
        (, uint256 activeAssetAmount, uint256 userDebt, uint256 supplied, ) = vaultEngine.vaults(assetId, user);
        require(userDebt == 0, "Shutdown/freeExcessCollateral: User needs to process debt first before calling this");

        // how do we make it so this can be reused
        uint256 hookedAmount = (supplied * finalAurUtilizationRatio);
        uint256 hookedCollAmount = hookedAmount / assets[assetId].finalPrice;
        require(activeAssetAmount > hookedCollAmount, "Shutdown/freeExcessCollateral: No collateral to free");

        uint256 amountToFree = activeAssetAmount - hookedCollAmount;

        vaultEngine.liquidateVault(assetId, user, user, address(this), -int256(amountToFree), 0, 0);
    }

    /**
     * @notice Uses the system reserve to write off bad debt
     */
    function writeOffFromReserves() external onlyWhenInShutdown {
        uint256 reserveBalance = vaultEngine.stablecoin(address(reservePool));
        uint256 amountToMove = min(aurGap, reserveBalance);
        vaultEngine.moveStablecoin(address(reservePool), address(this), amountToMove);
        aurGap -= amountToMove;
    }

    function calculateSupplierObligation() external onlyWhenInShutdown {
        // assumptions:
        //    - all under-collateralized vaults have been processed
        //    - all outstanding auctions are over

        require(finalDebtBalance != 0, "shutdown/setFinalDebtBalance: finalDebtBalance must be set first");

        require(
            aurGap == 0 || vaultEngine.stablecoin(address(reservePool)) == 0,
            "shutdown/setFinalDebtBalance: system reserve or aurGap must be zero"
        );

        supplierObligationRatio = wdiv(aurGap, finalDebtBalance);

        if (supplierObligationRatio >= WAD) {
            supplierObligationRatio = WAD;
        }
    }

    // process supplier side to fill the aur Gap created by under collateralized vaults
    function processUserEquity(bytes32 assetId, address user) external {
        require(supplierObligationRatio != 0, "Shutdown/processUserEquity:Supplier has no obligation");

        (, uint256 activeAssetAmount, , uint256 supplied, ) = vaultEngine.vaults(assetId, user);

        (, uint256 equityAccumulator, , , , , ) = vaultEngine.assets(assetId);
        uint256 hookedSuppliedAmount = (supplied * equityAccumulator * finalAurUtilizationRatio) / WAD;
        uint256 suppObligatedAmount = ((hookedSuppliedAmount * supplierObligationRatio) / WAD) /
            assets[assetId].finalPrice;
        uint256 amountToGrab = min(activeAssetAmount, suppObligatedAmount);

        if (amountToGrab > assets[assetId].gap) {
            amountToGrab = assets[assetId].gap;
        }
        assets[assetId].gap -= amountToGrab;
        aurGap -= amountToGrab * assets[assetId].finalPrice;

        vaultEngine.liquidateVault(
            assetId,
            user,
            address(this),
            address(this),
            -int256(amountToGrab),
            0,
            -int256(supplied)
        );
    }

    function setFinalDebtBalance() external onlyWhenInShutdown {
        require(finalDebtBalance == 0, "shutdown/setFinalDebtBalance: finalDebtBalance has already been set");
        require(
            block.timestamp >= initiatedAt + auctionWaitPeriod,
            "shutdown/setFinalDebtBalance: supplierWaitPeriod has not passed yet"
        );
        require(
            vaultEngine.unbackedDebt(address(reservePool)) == 0 || vaultEngine.stablecoin(address(reservePool)) == 0,
            "shutdown/setFinalDebtBalance: system reserve or debt must be zero"
        ); // system debt or system reserve should be zero

        finalDebtBalance = vaultEngine.totalDebt();
    }

    function calculateRedeemRatio(bytes32 assetId) external {
        require(finalDebtBalance != 0, "shutdown/calculateRedeemRatio: must set final debt balance first");

        (uint256 debtAccum, , , , , , ) = vaultEngine.assets(assetId);

        uint256 normalizedDebt = assets[assetId].normalizedDebt;

        uint256 max = (normalizedDebt * debtAccum) / assets[assetId].finalPrice;
        assets[assetId].redemptionRatio = ((max - assets[assetId].gap) * RAY) / (finalDebtBalance / RAY);
    }

    function returnStablecoin(uint256 amount) external {
        vaultEngine.moveStablecoin(msg.sender, address(this), amount);
        stablecoin[msg.sender] += amount;
    }

    function redeemCollateral(bytes32 assetId) external {
        // can withdraw collateral returnedStablecoin * collateralPerAUR for collateral type
        uint256 redeemAmount = ((stablecoin[msg.sender] / 1e9) * assets[assetId].redemptionRatio) /
            WAD /
            RAY -
            collRedeemed[assetId][msg.sender];

        collRedeemed[assetId][msg.sender] += redeemAmount;
        vaultEngine.moveAsset(assetId, address(this), msg.sender, redeemAmount);
    }

    function calculateIouRedemptionRatio() external {
        require(finalDebtBalance != 0, "");
        require(vaultEngine.stablecoin(address(reservePool)) != 0, "");
    }

    function setFinalSystemReserve() external {
        require(finalDebtBalance != 0, "shutdown/redeemVouchers: finalDebtBalance must be set first");

        uint256 totalSystemReserve = vaultEngine.stablecoin(address(reservePool));
        require(totalSystemReserve != 0, "shutdown/setFinalSystemReserve: system reserve is zero");

        finalTotalReserve = totalSystemReserve;
    }

    function redeemVouchers() external {
        require(finalTotalReserve != 0, "shutdown/redeemVouchers: finalTotalReserve must be set first");

        uint256 userVouchers = reservePool.vouchers(msg.sender);
        uint256 totalVouchers = reservePool.totalVouchers();

        require(userVouchers != 0 && totalVouchers != 0, "shutdown/redeemVouchers: no vouchers to redeem");

        uint256 percentageOfIous = rdiv(userVouchers, totalVouchers);
        uint256 shareOfAur = rmul(percentageOfIous, finalTotalReserve);

        if (shareOfAur > userVouchers) {
            shareOfAur = userVouchers;
        }

        reservePool.shutdownRedemption(msg.sender, shareOfAur);
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    function min(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a > b) {
            return b;
        } else {
            return a;
        }
    }

    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * y) + (RAY / 2)) / RAY;
    }

    function wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * WAD) + y / 2) / y;
    }

    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = ((x * RAY) + y / 2) / y;
    }
}
