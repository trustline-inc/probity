// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

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

    function systemDebt(address user) external returns (uint256 value);

    function totalDebt() external returns (uint256 value);

    function totalStablecoin() external returns (uint256 value);

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
            uint256 standby,
            uint256 underlying,
            uint256 collateral,
            uint256 debt,
            uint256 equity,
            uint256 initialEquity
        );

    function assets(bytes32 assetId)
        external
        returns (
            uint256 debtAccumulator,
            uint256 equityAccumulator,
            uint256 price,
            uint256 normDebt,
            uint256 normEquity,
            uint256 ceiling,
            uint256 floor
        );

    function liquidateDebtPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collAmount,
        int256 debt
    ) external;

    function liquidateEquityPosition(
        bytes32 assetId,
        address user,
        address treasury,
        int256 assetToAuction,
        int256 assetToReturn,
        int256 equity
    ) external;
}

interface ReservePoolLike {
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

interface BondIssuerLike {
    function vouchers(address user) external returns (uint256 balance);

    function totalVouchers() external returns (uint256);

    function shutdownRedemption(address user, uint256 amount) external;

    function setShutdownState() external;
}

contract Shutdown is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////

    struct Asset {
        uint256 finalPrice;
        uint256 normDebt;
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
    BondIssuerLike public bondIssuer;

    bool public initiated;
    uint256 public initiatedAt;
    uint256 public auctionWaitPeriod = 2 days;
    uint256 public supplierWaitPeriod = 2 days;
    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => mapping(address => uint256)) public collRedeemed;
    mapping(address => uint256) public stablecoin;
    uint256 public finalUtilizationRatio;
    uint256 public redemptionRatio;
    uint256 public stablecoinGap;
    uint256 public investorObligationRatio;
    uint256 public finalStablecoinBalance;
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
        LiquidatorLike liquidatorAddress,
        BondIssuerLike bondIssuerAddress
    ) Stateful(registryAddress) {
        priceFeed = priceFeedAddress;
        vaultEngine = vaultAddress;
        reservePool = reservePoolAddress;
        teller = tellerAddress;
        treasury = treasuryAddress;
        liquidator = liquidatorAddress;
        bondIssuer = bondIssuerAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @notice TODO
     * @param which TODO
     * @param newAddress TODO
     */
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
        } else if (which == "bondIssuer") {
            bondIssuer = BondIssuerLike(newAddress);
        } else {
            revert("shutdown/switchAddress: unknown which");
        }
    }

    /**
     * @notice TODO
     * @param which TODO
     * @param newWaitPeriod TODO
     */
    function changeWaitPeriod(bytes32 which, uint256 newWaitPeriod) external onlyBy("gov") {
        if (which == "auctionWaitPeriod") {
            auctionWaitPeriod = newWaitPeriod;
        } else if (which == "supplierWaitPeriod") {
            supplierWaitPeriod = newWaitPeriod;
        } else {
            revert("shutdown/changeWaitPeriod: unknown which");
        }
    }

    /**
     * @notice Initiates the system shutdown sequence
     * @dev This action is irreversible.
     */
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
        bondIssuer.setShutdownState();

        uint256 totalDebt = vaultEngine.totalDebt();
        uint256 totalEquity = vaultEngine.totalEquity();
        if (totalEquity != 0) {
            if (totalDebt >= totalEquity) {
                finalUtilizationRatio = RAY;
            } else {
                finalUtilizationRatio = wdiv(totalDebt, totalEquity);
            }
        }
    }

    /**
     * @notice Sets the final price for the given asset
     * @param assetId The ID of the asset to finalize the price of
     */
    function setFinalPrice(bytes32 assetId) external onlyWhenInShutdown {
        uint256 price = priceFeed.getPrice(assetId);
        require(price != 0, "Shutdown/setFinalPrice: Price retrieved is zero");
        (, , , assets[assetId].normDebt, , , ) = vaultEngine.assets(assetId);
        assets[assetId].finalPrice = price;
    }

    /**
     * @notice Cancels outstanding debt, collects the appropriate amount of collateral, & frees excess collateral
     * @param assetId The ID of the vault asset
     * @param user The address of the vault user
     */
    function processUserDebt(bytes32 assetId, address user) external onlyIfFinalPriceSet(assetId) {
        (, , uint256 collateral, uint256 debt, , ) = vaultEngine.vaults(assetId, user);
        (uint256 debtAccumulator, , , , , , ) = vaultEngine.assets(assetId);

        uint256 required = (debt * debtAccumulator) / assets[assetId].finalPrice;
        uint256 amountToGrab = min(collateral, required);
        uint256 gap = required - amountToGrab;
        assets[assetId].gap += gap;
        stablecoinGap += gap * assets[assetId].finalPrice;

        vaultEngine.liquidateDebtPosition(
            assetId,
            user,
            address(this),
            address(this),
            -int256(amountToGrab),
            -int256(debt)
        );
    }

    /**
     * @notice TODO
     * @param assetId The ID of the asset to free
     * @param user The address of the user vault
     */
    function freeExcessAsset(bytes32 assetId, address user) external onlyIfFinalPriceSet(assetId) {
        (, , uint256 collateral, uint256 debt, , uint256 initialEquity) = vaultEngine.vaults(assetId, user);
        require(debt == 0, "Shutdown/freeExcessAsset: User needs to process debt first before calling this");

        // how do we make it so this can be reused
        uint256 hookedAmount = (initialEquity * finalUtilizationRatio);
        uint256 hookedCollAmount = hookedAmount / assets[assetId].finalPrice;
        require(collateral > hookedCollAmount, "Shutdown/freeExcessAsset: No collateral to free");

        uint256 amountToFree = collateral - hookedCollAmount;

        vaultEngine.liquidateDebtPosition(assetId, user, user, address(this), -int256(amountToFree), 0);
    }

    /**
     * @notice Uses the system reserve to write off bad debt
     */
    function writeOffFromReserves() external onlyWhenInShutdown {
        uint256 reserveBalance = vaultEngine.stablecoin(address(reservePool));
        uint256 amountToMove = min(stablecoinGap, reserveBalance);
        vaultEngine.moveStablecoin(address(reservePool), address(this), amountToMove);
        stablecoinGap -= amountToMove;
    }

    /**
     * @notice TODO
     */
    function calculateInvestorObligation() external onlyWhenInShutdown {
        // assumptions:
        //    - all under-collateralized vaults have been processed
        //    - all outstanding auctions are over

        require(
            finalStablecoinBalance != 0,
            "shutdown/calculateInvestorObligation: finalStablecoinBalance must be set first"
        );

        require(
            stablecoinGap == 0 || vaultEngine.stablecoin(address(reservePool)) == 0,
            "shutdown/calculateInvestorObligation: system reserve or stablecoin gap must be zero"
        );
        uint256 stablecoinUtilized = (vaultEngine.totalEquity() / WAD) * finalUtilizationRatio;
        investorObligationRatio = (stablecoinGap * WAD) / stablecoinUtilized;
        if (investorObligationRatio > WAD) {
            investorObligationRatio = WAD;
        }
    }

    /**
     * @notice Process equity positions to write off unbacked debt
     * @param assetId The ID of the asset to process
     * @param user The address of the user vault to process
     */
    function processUserEquity(bytes32 assetId, address user) external {
        require(investorObligationRatio != 0, "Shutdown/processUserEquity: Investor has no obligation");

        (, uint256 underlying, , , uint256 equity, uint256 initialEquity) = vaultEngine.vaults(assetId, user);
        uint256 hookedSuppliedAmount = (initialEquity / WAD) * finalUtilizationRatio;
        uint256 investorObligation = ((hookedSuppliedAmount * investorObligationRatio) / WAD) /
            assets[assetId].finalPrice;
        uint256 amountToGrab = min(underlying, investorObligation);

        if (amountToGrab > assets[assetId].gap) {
            amountToGrab = assets[assetId].gap;
        }

        assets[assetId].gap -= amountToGrab;
        stablecoinGap -= amountToGrab * assets[assetId].finalPrice;

        vaultEngine.liquidateEquityPosition(assetId, user, address(treasury), 0, -int256(underlying), -int256(equity));
    }

    /**
     * @notice TODO
     */
    function setFinalStablecoinBalance() external onlyWhenInShutdown {
        require(finalStablecoinBalance == 0, "shutdown/setFinalStablecoinBalance: Balance already set");
        require(
            block.timestamp >= initiatedAt + auctionWaitPeriod,
            "shutdown/setFinalStablecoinBalance: Waiting for auctions to complete"
        );
        require(
            vaultEngine.systemDebt(address(reservePool)) == 0 || vaultEngine.stablecoin(address(reservePool)) == 0,
            "shutdown/setFinalStablecoinBalance: system reserve or debt must be zero"
        );

        finalStablecoinBalance = vaultEngine.totalStablecoin();
    }

    /**
     * @notice TODO
     * @param assetId The ID of the asset to be redeemed
     */
    function calculateRedemptionRatio(bytes32 assetId) external {
        require(finalStablecoinBalance != 0, "shutdown/calculateRedemptionRatio: Must set final debt balance first");
        (uint256 debtAccumulator, , , , , , ) = vaultEngine.assets(assetId);
        uint256 normDebt = assets[assetId].normDebt;
        uint256 max = (normDebt * debtAccumulator) / assets[assetId].finalPrice;
        assets[assetId].redemptionRatio = ((max - assets[assetId].gap) * RAY) / (finalStablecoinBalance / RAY);
    }

    /**
     * @notice TODO
     * @param amount TODO
     */
    function returnStablecoin(uint256 amount) external {
        vaultEngine.moveStablecoin(msg.sender, address(this), amount);
        stablecoin[msg.sender] += amount;
    }

    /**
     * @notice TODO
     * @param assetId TODO
     */
    function redeemAsset(bytes32 assetId) external {
        // can withdraw collateral returnedStablecoin * collateralPerAUR for collateral type
        uint256 redeemAmount = ((stablecoin[msg.sender] / 1e9) * assets[assetId].redemptionRatio) /
            WAD /
            RAY -
            collRedeemed[assetId][msg.sender];

        collRedeemed[assetId][msg.sender] += redeemAmount;
        vaultEngine.moveAsset(assetId, address(this), msg.sender, redeemAmount);
    }

    /**
     * @notice TODO why is this empty
     */
    function calculateIouRedemptionRatio() external {
        require(finalStablecoinBalance != 0, "");
        require(vaultEngine.stablecoin(address(reservePool)) != 0, "");
    }

    /**
     * @notice TODO
     */
    function setFinalSystemReserve() external {
        require(finalStablecoinBalance != 0, "shutdown/redeemVouchers: finalStablecoinBalance must be set first");

        uint256 totalSystemReserve = vaultEngine.stablecoin(address(reservePool));
        require(totalSystemReserve != 0, "shutdown/setFinalSystemReserve: system reserve is zero");

        finalTotalReserve = totalSystemReserve;
    }

    /**
     * @notice TODO
     */
    function redeemVouchers() external {
        require(finalTotalReserve != 0, "shutdown/redeemVouchers: finalTotalReserve must be set first");

        uint256 userVouchers = bondIssuer.vouchers(msg.sender);
        uint256 totalVouchers = bondIssuer.totalVouchers();

        require(userVouchers != 0 && totalVouchers != 0, "shutdown/redeemVouchers: no vouchers to redeem");

        uint256 percentageOfIous = rdiv(userVouchers, totalVouchers);
        uint256 shareOfAur = rmul(percentageOfIous, finalTotalReserve);

        if (shareOfAur > userVouchers) {
            shareOfAur = userVouchers;
        }

        bondIssuer.shutdownRedemption(msg.sender, shareOfAur);
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
