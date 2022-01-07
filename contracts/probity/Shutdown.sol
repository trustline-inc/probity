// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "./Treasury.sol";
import "./priceFunction/LinearDecrease.sol";

// Shutdown Module's main purpose is to pause probity functionality and
// allow user to redeem AUR for the remaining
// collateral in the system
// Step 1. Pause all normal functionality
// Step 2. Set Final price of all collateral
// Step 3. free up collateral on Over Collateralized vaults,
// allow users to withdraw free Collateral (this is only available after final price has been set)
// Step 4. Allow Auctions to finish (is this gonna take too long?)
// Step 5. Calculate net +/- in reserve vs system debt
// Step 6. Calculate the net deficit in UnderCollateralized vaults
// (both debt side and supply side) (can we do this earlier?)
// Step 7. Calculate final Collateral per AUR = Collateral / Total AUR in Circulation

interface PriceFeedLike {
    function setShutdownState() external;

    function getPrice(bytes32 collId) external returns (uint256 price);
}

interface VaultLike {
    function setShutdownState() external;

    function stablecoin(address user) external returns (uint256 value);

    function unbackedStablecoin(address user) external returns (uint256 value);

    function totalDebt() external returns (uint256 value);

    function totalEquity() external returns (uint256 value);

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;

    function moveCollateral(
        bytes32 collId,
        address from,
        address to,
        uint256 amount
    ) external;

    function vaults(bytes32 collId, address user)
        external
        returns (
            uint256 freeColl,
            uint256 lockedColl,
            uint256 debt,
            uint256 supplied,
            uint256 lastSuppAccu
        );

    function collateralTypes(bytes32 collId)
        external
        returns (
            uint256 debtAccu,
            uint256 suppAccu,
            uint256 price,
            uint256 normDebt,
            uint256 normEquity,
            uint256 ceiling,
            uint256 floor
        );

    function liquidateVault(
        bytes32 collId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collAmount,
        int256 debt,
        int256 equity
    ) external;
}

interface ReservePoolLike {
    function ious(address user) external returns (uint256 balance);

    function totalIous() external returns (uint256);

    function shutdownRedemption(address user, uint256 amount) external;

    function setShutdownState() external;
}

interface AuctioneerLike {
    function cancelAuction(uint256 auctionId, address recipient) external;

    function auctions(
        bytes32 collId,
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
    function collateralTypes(bytes32 collId)
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
        uint256 redeemRatio;
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
    mapping(bytes32 => Collateral) public collateralTypes;
    mapping(bytes32 => mapping(address => uint256)) public collRedeemed;
    mapping(address => uint256) public stablecoin;
    uint256 public finalAurUtilizationRatio;
    uint256 public redeemRatio;
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

    modifier onlyIfFinalPriceSet(bytes32 collId) {
        require(
            collateralTypes[collId].finalPrice != 0,
            "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this collId"
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
    function setFinalPrice(bytes32 collId) external onlyWhenInShutdown {
        uint256 price = priceFeed.getPrice(collId);
        require(price != 0, "Shutdown/setFinalPrice: price retrieved is zero");

        (, , , collateralTypes[collId].normalizedDebt, , , ) = vaultEngine.collateralTypes(collId);

        collateralTypes[collId].finalPrice = price;
    }

    // process the vault:
    // cancel all outstanding debt,
    // collect the appropriate amount of collateral, free up extra collateral
    // suppliers's collateral should
    function processUserDebt(bytes32 collId, address user) external onlyIfFinalPriceSet(collId) {
        (, uint256 lockedColl, uint256 userDebt, , ) = vaultEngine.vaults(collId, user);
        (uint256 debtAccu, , , , , , ) = vaultEngine.collateralTypes(collId);

        uint256 debtCollAmount = (userDebt * debtAccu) / collateralTypes[collId].finalPrice;
        uint256 amountToGrab = min(lockedColl, debtCollAmount);
        uint256 gap = debtCollAmount - amountToGrab;
        collateralTypes[collId].gap += gap;
        aurGap += gap * collateralTypes[collId].finalPrice;

        vaultEngine.liquidateVault(
            collId,
            user,
            address(this),
            address(this),
            -int256(amountToGrab),
            -int256(userDebt),
            0
        );
    }

    function freeExcessCollateral(bytes32 collId, address user) external onlyIfFinalPriceSet(collId) {
        (, uint256 lockedColl, uint256 userDebt, uint256 supplied, ) = vaultEngine.vaults(collId, user);
        require(userDebt == 0, "Shutdown/freeExcessCollateral: User needs to process debt first before calling this");

        // how do we make it so this can be reused
        uint256 hookedAmount = (supplied * finalAurUtilizationRatio);
        uint256 hookedCollAmount = hookedAmount / collateralTypes[collId].finalPrice;
        require(lockedColl > hookedCollAmount, "Shutdown/freeExcessCollateral: No collateral to free");

        uint256 amountToFree = lockedColl - hookedCollAmount;

        vaultEngine.liquidateVault(collId, user, user, address(this), -int256(amountToFree), 0, 0);
    }

    function fillInAurGap() external onlyWhenInShutdown {
        // use system reserve to fill in AurGap
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
    function processUserEquity(bytes32 collId, address user) external {
        require(supplierObligationRatio != 0, "Shutdown/processUserEquity:Supplier has no obligation");

        (, uint256 lockedColl, , uint256 supplied, ) = vaultEngine.vaults(collId, user);

        (, uint256 equityAccumulator, , , , , ) = vaultEngine.collateralTypes(collId);
        uint256 hookedSuppliedAmount = (supplied * equityAccumulator * finalAurUtilizationRatio) / WAD;
        uint256 suppObligatedAmount = ((hookedSuppliedAmount * supplierObligationRatio) / WAD) /
            collateralTypes[collId].finalPrice;
        uint256 amountToGrab = min(lockedColl, suppObligatedAmount);

        if (amountToGrab > collateralTypes[collId].gap) {
            amountToGrab = collateralTypes[collId].gap;
        }
        collateralTypes[collId].gap -= amountToGrab;
        aurGap -= amountToGrab * collateralTypes[collId].finalPrice;

        vaultEngine.liquidateVault(
            collId,
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
            vaultEngine.unbackedStablecoin(address(reservePool)) == 0 ||
                vaultEngine.stablecoin(address(reservePool)) == 0,
            "shutdown/setFinalDebtBalance: system reserve or debt must be zero"
        ); // system debt or system reserve should be zero

        finalDebtBalance = vaultEngine.totalDebt();
    }

    function calculateRedeemRatio(bytes32 collId) external {
        require(finalDebtBalance != 0, "shutdown/calculateRedeemRatio: must set final debt balance first");

        (uint256 debtAccu, , , , , , ) = vaultEngine.collateralTypes(collId);

        uint256 normalizedDebt = collateralTypes[collId].normalizedDebt;

        uint256 max = (normalizedDebt * debtAccu) / collateralTypes[collId].finalPrice;
        collateralTypes[collId].redeemRatio = ((max - collateralTypes[collId].gap) * RAY) / (finalDebtBalance / RAY);
    }

    function returnStablecoin(uint256 amount) external {
        vaultEngine.moveStablecoin(msg.sender, address(this), amount);
        stablecoin[msg.sender] += amount;
    }

    function redeemCollateral(bytes32 collId) external {
        // can withdraw collateral returnedStablecoin * collateralPerAUR for collateral type
        uint256 redeemAmount = ((stablecoin[msg.sender] / 1e9) * collateralTypes[collId].redeemRatio) /
            WAD /
            RAY -
            collRedeemed[collId][msg.sender];

        collRedeemed[collId][msg.sender] += redeemAmount;
        vaultEngine.moveCollateral(collId, address(this), msg.sender, redeemAmount);
    }

    function calculateIouRedemptionRatio() external {
        require(finalDebtBalance != 0, "");
        require(vaultEngine.stablecoin(address(reservePool)) != 0, "");
    }

    function setFinalSystemReserve() external {
        require(finalDebtBalance != 0, "shutdown/redeemIou: finalDebtBalance must be set first");

        uint256 totalSystemReserve = vaultEngine.stablecoin(address(reservePool));
        require(totalSystemReserve != 0, "shutdown/setFinalSystemReserve: system reserve is zero");

        finalTotalReserve = totalSystemReserve;
    }

    function redeemIou() external {
        require(finalTotalReserve != 0, "shutdown/redeemIou: finalTotalReserve must be set first");

        uint256 userIouBalance = reservePool.ious(msg.sender);
        uint256 totalIouBalance = reservePool.totalIous();

        require(userIouBalance != 0 && totalIouBalance != 0, "shutdown/redeemIou: no iou to redeem");

        uint256 percentageOfIous = rdiv(userIouBalance, totalIouBalance);
        uint256 shareOfAur = rmul(percentageOfIous, finalTotalReserve);

        if (shareOfAur > userIouBalance) {
            shareOfAur = userIouBalance;
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
