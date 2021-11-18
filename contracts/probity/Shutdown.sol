// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "hardhat/console.sol";
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
//

interface PriceFeedLike {
    function setShutdownState() external;

    function getPrice(bytes32 collId) external returns (uint256 price);
}

interface VaultLike {
    function setShutdownState() external;

    function aur(address user) external returns (uint256 value);

    function unbackedAurei(address user) external returns (uint256 value);

    function totalDebt() external returns (uint256 value);

    function totalCapital() external returns (uint256 value);

    function moveAurei(
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
            uint256 normSupply,
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
        int256 supply
    ) external;
}

interface ReservePoolLike {
    function ious(address user) external returns (uint256 balance);

    function totalIous() external returns (uint256 totalIous);

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
    mapping(address => uint256) public aur;
    uint256 public finalAurUtilizationRatio;
    uint256 public redeemRatio;
    uint256 public aurGap; // value of under-collateralized vaults
    uint256 public supplierObligationRatio;
    uint256 public debt;
    uint256 public finalDebtBalance;

    /////////////////////////////////////////
    // Modifier
    /////////////////////////////////////////

    modifier onlyWhenInShutdown() {
        require(
            initiated,
            "Shutdown/onlyWhenInShutdown: Shutdown has not been initiated"
        );
        _;
    }

    modifier onlyWhenNotInShutdown() {
        require(
            !initiated,
            "Shutdown/onlyWhenNotInShutdown: Shutdown has already been initiated"
        );
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

    function switchAddress(bytes32 which, address newAddress)
        external
        onlyWhenNotInShutdown
        onlyBy("gov")
    {
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

    function changeWaitPeriod(bytes32 which, uint256 newWaitPeriod)
        external
        onlyBy("gov")
    {
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
        uint256 totalCapital = vaultEngine.totalCapital();
        //        console.log("debt   : %s", totalDebt);
        //        console.log("capital: %s", totalCapital);
        if (totalCapital != 0) {
            if (totalDebt >= totalCapital) {
                finalAurUtilizationRatio = RAY;
            } else {
                finalAurUtilizationRatio = wdiv(totalDebt, totalCapital);
            }
        }
        //        console.log("final ratio : %s", finalAurUtilizationRatio);
    }

    // step 2: set final prices
    function setFinalPrice(bytes32 collId) external onlyWhenInShutdown {
        uint256 price = priceFeed.getPrice(collId);
        require(price != 0, "Shutdown/setFinalPrice: price retrieved is zero");

        (, , , collateralTypes[collId].normalizedDebt, , , ) = vaultEngine
            .collateralTypes(collId);

        collateralTypes[collId].finalPrice = price;
    }

    // process the vault:
    // cancel all outstanding debt,
    // collect the appropriate amount of collateral, free up extra collateral
    // suppliers's collateral should
    function processUserDebt(bytes32 collId, address user)
        external
        onlyIfFinalPriceSet(collId)
    {
        (, uint256 lockedColl, uint256 userDebt, , ) =
            vaultEngine.vaults(collId, user);
        (uint256 debtAccu, , , , , , ) = vaultEngine.collateralTypes(collId);

        uint256 debtCollAmount =
            (userDebt * debtAccu) / collateralTypes[collId].finalPrice;
        uint256 amountToGrab = min(lockedColl, debtCollAmount);
        uint256 gap = debtCollAmount - amountToGrab;
        collateralTypes[collId].gap += gap;
        aurGap += gap * collateralTypes[collId].finalPrice;

        //                console.log("lockedColl     : %s", lockedColl);
        //                console.log("userDebt       : %s", userDebt);
        //                console.log("test           : %s", (userDebt * debtAccu) / collateralTypes[collId].finalPrice);
        //                console.log("debtAccu       : %s", debtAccu);
        //                console.log("final Price    : %s", collateralTypes[collId].finalPrice);
        //                console.log("debtCollAmount : %s", debtCollAmount);
        //                console.log("amountToGrab   : %s", amountToGrab);
        //                console.log("gap            : %s", gap);
        //                console.log("aurGap         : %s", aurGap);
        //                console.log("");

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

    function freeExcessCollateral(bytes32 collId, address user)
        external
        onlyIfFinalPriceSet(collId)
    {
        (, uint256 lockedColl, uint256 userDebt, uint256 supplied, ) =
            vaultEngine.vaults(collId, user);
        require(
            userDebt == 0,
            "Shutdown/freeExcessCollateral: User needs to process debt first before calling this"
        );

        // how do we make it so this can be reused
        uint256 hookedAmount = (supplied * finalAurUtilizationRatio);
        uint256 hookedCollAmount =
            hookedAmount / collateralTypes[collId].finalPrice;
        require(
            lockedColl > hookedCollAmount,
            "Shutdown/freeExcessCollateral: No collateral to free"
        );

        uint256 amountToFree = lockedColl - hookedCollAmount;

        vaultEngine.liquidateVault(
            collId,
            user,
            user,
            address(this),
            -int256(amountToFree),
            0,
            0
        );
    }

    // @todo how to account for the IOUs
    // - iou sale should stop selling immediately when shutdown is initiated
    //
    // three possible path :
    //      - IOUs holders will get nothing (because they hold the risk)
    //      - IOUs will be paid back by adding to the totalDebt (we are not doing this)
    //      - IOUs holders can only redeem if there are extra system reserve (how to achieve this?)

    function cancelAuction(bytes32 collId, uint256 auctionId)
        external
        onlyWhenInShutdown
    {
        // liquidator fetch the auctioneer address

        (address auctioneerAddress, , ) = liquidator.collateralTypes(collId);
        AuctioneerLike auctioneer = AuctioneerLike(auctioneerAddress);
        auctioneer.cancelAuction(auctionId, address(this));

        // we are assuming here that when we calculate redeem ratio, the reserve's system debt will be accounted for
    }

    function calculateSupplierObligation() external onlyWhenInShutdown {
        // assumptions:
        //    - all under-collateralized vaults have been processed
        //    - all outstanding auctions are over
        require(
            block.timestamp >= initiatedAt + auctionWaitPeriod,
            "shutdown/calculateSupplierObligation: auction wait period is not over"
        );

        require(
            vaultEngine.unbackedAurei(address(reservePool)) == 0 ||
                vaultEngine.aur(address(reservePool)) == 0,
            "shutdown/setFinalDebtBalance: system reserve or debt must be zero"
        ); // system debt or system reserve should be zero

        uint256 reserve = vaultEngine.aur(address(reservePool));
        uint256 systemDebt = vaultEngine.unbackedAurei(address(reservePool));
        uint256 totalSupply = vaultEngine.totalCapital();

        //                console.log("reserve        : %s", reserve);
        //                console.log("systemDebt     : %s", systemDebt);
        //                console.log("totalSupply    : %s", totalSupply);
        //                console.log("aurGap         : %s", aurGap);
        //                console.log("debt           : %s", debt);

        if (reserve < systemDebt) {
            // system in debt
            aurGap += systemDebt - reserve;
        } else {
            // system have surplus
            if (reserve - systemDebt >= aurGap) {
                aurGap = 0;
            } else {
                aurGap -= reserve - systemDebt;
                debt = reserve - systemDebt;
            }
        }

        // this should be a smaller percentage than the finalAurUtilizationRatio
        // because it uses totalDebt instead of just the gap
        supplierObligationRatio = rdiv(aurGap, totalSupply);

        if (supplierObligationRatio >= RAY) {
            supplierObligationRatio = RAY;
        }

        //                console.log("aurGap         : %s", aurGap);
        //                console.log("debt           : %s", debt);
        //                console.log("suppObligation : %s", supplierObligationRatio);
        //                console.log("");
    }

    // process supplier side to fill the aur Gap created by under collateralized vaults
    function processUserSupply(bytes32 collId, address user) external {
        require(
            supplierObligationRatio != 0,
            "Shutdown/processUserSupply:Supplier has no obligation"
        );

        (, uint256 lockedColl, , uint256 supplied, ) =
            vaultEngine.vaults(collId, user);

        uint256 suppObligatedAmount =
            (supplied * supplierObligationRatio) /
                collateralTypes[collId].finalPrice;
        uint256 amountToGrab = min(lockedColl, suppObligatedAmount);
        //                console.log("lockedColl     : %s", lockedColl);
        //                console.log("supplied       : %s", supplied);
        //                console.log("obligRatio     : %s", supplierObligationRatio);
        //                console.log("amountToGrab   : %s", amountToGrab);
        //                console.log("suppObligAmount: %s", suppObligatedAmount);
        //                console.log("coll Gap       : %s", collateralTypes[collId].gap);
        //                console.log("aur Gap        : %s", aurGap);

        collateralTypes[collId].gap -= amountToGrab;
        aurGap -= amountToGrab * collateralTypes[collId].finalPrice;

        //                console.log("coll Gap       : %s", collateralTypes[collId].gap);
        //                console.log("aur Gap        : %s", aurGap);
        //                console.log("");

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
        require(
            finalDebtBalance == 0,
            "shutdown/setFinalDebtBalance: finalDebtBalance has already been set"
        );
        require(
            block.timestamp >=
                initiatedAt + auctionWaitPeriod + supplierWaitPeriod,
            "shutdown/setFinalDebtBalance: supplierWaitPeriod has not passed yet"
        ); // the supplierWaitPeriod started at
        require(
            vaultEngine.unbackedAurei(address(reservePool)) == 0 ||
                vaultEngine.aur(address(reservePool)) == 0,
            "shutdown/setFinalDebtBalance: system reserve or debt must be zero"
        ); // system debt or system reserve should be zero

        finalDebtBalance = vaultEngine.totalDebt();
    }

    function calculateRedeemRatio(bytes32 collId) external {
        require(
            finalDebtBalance != 0,
            "shutdown/calculateRedeemRatio: must set final debt balance first"
        );

        (uint256 debtAccu, , , , , , ) = vaultEngine.collateralTypes(collId);

        uint256 normalizedDebt = collateralTypes[collId].normalizedDebt;

        uint256 one =
            (normalizedDebt * debtAccu) / collateralTypes[collId].finalPrice;
        //            rdiv(rmul(normalizedDebt, debtAccu), collateralTypes[collId].finalPrice);

        //                console.log("debtAccu       : %s", debtAccu);
        //                console.log("normalizedDebt : %s", normalizedDebt);
        //                console.log("first          : %s", rmul(normalizedDebt, debtAccu));
        //                console.log("one            : %s", one);
        //                console.log("finalPrice     : %s", collateralTypes[collId].finalPrice);
        //                console.log("gap            : %s", collateralTypes[collId].gap);
        //                console.log("availableColl  : %s", availableColl);
        //                console.log("reserve        : %s", reserve);
        //                console.log("totalDebt      : %s", vaultEngine.totalDebt());
        //                console.log("aurCirculation : %s", aurCirculation);
        //                console.log("test           : %s", one - collateralTypes[collId].gap);

        collateralTypes[collId].redeemRatio =
            ((one - collateralTypes[collId].gap) * RAY) /
            (finalDebtBalance / RAY);

        //        console.log("redeemRatio    : %s", collateralTypes[collId].redeemRatio);
        //        console.log("finalDebt Bal  : %s", finalDebtBalance);
        //        console.log("");
    }

    function returnAurei(uint256 amount) external {
        vaultEngine.moveAurei(msg.sender, address(this), amount);
        aur[msg.sender] += amount;
    }

    function redeemCollateral(bytes32 collId) external {
        (uint256 balance, , , , ) = vaultEngine.vaults(collId, address(this));

        // can withdraw collateral returnedAurei * collateralPerAUR for collateral type
        uint256 redeemAmount =
            (aur[msg.sender] * collateralTypes[collId].redeemRatio) /
                RAY /
                RAY -
                collRedeemed[collId][msg.sender];

        //                console.log("balance        : %s", balance);
        //                console.log("aur[msg.sender]: %s", aur[msg.sender]);
        //                console.log("redeemRatio    : %s", collateralTypes[collId].redeemRatio);
        //                console.log("redeemAmount   : %s", redeemAmount);

        collRedeemed[collId][msg.sender] += redeemAmount;
        vaultEngine.moveCollateral(
            collId,
            address(this),
            msg.sender,
            redeemAmount
        );

        //        console.log("collRedeemed   : %s", collRedeemed[collId][msg.sender]);
        //        console.log("");
    }

    function calculateIouRedemptionRatio() external {
        require(finalDebtBalance != 0, "");
        require(vaultEngine.aur(address(reservePool)) != 0, "");
    }

    function redeemIou() external {
        require(
            finalDebtBalance != 0,
            "shutdown/redeemIou: finalDebtBalance must be set first"
        );

        uint256 userIouBalance = reservePool.ious(msg.sender);
        uint256 totalIouBalance = reservePool.totalIous();

        require(
            userIouBalance != 0 && totalIouBalance != 0,
            "shutdown/redeemIou: no iou to redeem"
        );

        uint256 totalSystemReserve = vaultEngine.aur(address(reservePool));
        require(
            totalSystemReserve != 0,
            "shutdown/redeemIou: no aur to redeem"
        );

        uint256 percentageOfIous = rdiv(userIouBalance, totalIouBalance);
        uint256 shareOfAur = rmul(percentageOfIous, totalSystemReserve);

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
        z = ((x * WAD) + y / 2) / y;
    }
}
