// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";

interface PriceFeedLike {
    function setShutdownState() external;

    function getPrice(bytes32 assetId) external returns (uint256 price);
}

interface VaultLike {
    function setShutdownState() external;

    function systemCurrency(address user) external returns (uint256 value);

    function systemDebt(address user) external returns (uint256 value);

    function lendingPoolDebt() external returns (uint256 value);

    function totalSystemCurrency() external returns (uint256 value);

    function lendingPoolEquity() external returns (uint256 value);

    function moveSystemCurrency(
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
            uint256 standbyAmount,
            uint256 underlying,
            uint256 collateral,
            uint256 normDebt,
            uint256 normEquity,
            uint256 initialEquity
        );

    function debtAccumulator() external returns (uint256 debAccumulator);

    function assets(bytes32 assetId)
        external
        returns (
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
        int256 equity,
        int256 initialEquity
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
    function bondTokens(address user) external returns (uint256 balance);

    function totalBondTokens() external returns (uint256);

    function shutdownRedemption(address user, uint256 amount) external;

    function setShutdownState() external;
}

/**
 * The shutdown module's main purpose is to pause functionality and
 * allow borrowers to redeem systemCurrency for the remaining collateral
 * and allows investors to redeem underlying assets.
 *
 * Step 1: Pause all normal functionality
 * Step 2: Set final asset prices
 * Step 3: Allow users to withdraw excess assets from healthy vaults
 * Step 4: Allow auctions to finish (is this gonna take too long?)
 * Step 5: Calculate net +/- in reserve vs. system debt
 * Step 6: Calculate the net deficit in unhealthy vaults (can we do this earlier?)
 * Step 7: Calculate final asset per USD = amount of asset in vault / total USD in circulation
 */

contract Shutdown is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////

    struct Asset {
        uint256 finalPrice; // [RAY]
        uint256 normDebt; // [WAD]
        uint256 gap; // [WAD]
        uint256 redemptionRatio; // [WAD]
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

    bool public initiated; // whether or not shutdown has been initiated
    uint256 public initiatedAt;
    uint256 public auctionWaitPeriod = 2 days; // the wait period for existing auctions to end
    uint256 public supplierWaitPeriod = 2 days; // the wait period for supplier's vault to be processed
    mapping(bytes32 => Asset) public assets; // assetId -> Asset
    // assetId -> redeemer's address -> amount redeemed
    mapping(bytes32 => mapping(address => uint256)) public collRedeemed;
    // redeemer's address -> systemCurrency balance already returned [RAD]
    mapping(address => uint256) public systemCurrency;
    uint256 public finalUtilizationRatio; // Total Equity Utilization Ratio at the moment shutdown is initiated [WAD]
    uint256 public systemCurrencyGap; // amount of systemCurrency that doesn't have collateral backing [RAD]
    // ratio of equity position's underlying asset that will be used to cover the systemCurrency Gap [WAD]
    uint256 public investorObligationRatio;
    uint256 public finalSystemCurrencyBalance; // final balance of how much systemCurrency are in circulation [RAD]
    uint256 public finalTotalReserve; // final balance of the systemCurrency held by reserve pool [RAD]

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

    event ContractAddressChanged(bytes32 which, address newAddress);
    event WaitPeriodChanged(bytes32 which, uint256 newWaitPeriod);
    event FinalPriceSet(bytes32 assetId, uint256 finalPrice);
    event DebtPositionProcessed(bytes32 assetId, address user, uint256 assetGap, uint256 systemCurrencyGap);
    event EquityPositionProcessed(bytes32 assetId, address user, uint256 assetCovered, uint256 systemCurrencyCovered);
    event InvestorObligationCalculated(uint256 investorObligationRatio);
    event FinalSystemCurrencyBalanceSet(uint256 finalSystemCurrencyBalance);
    event RedemptionRatioCalculated(bytes32 assetId, uint256 redemptionRatio);
    event SystemCurrencyReturned(address user, uint256 amount);
    event AssetRedeemed(bytes32 assetId, address user, uint256 amountRedeemed);
    event BondTokensRedeemed(address user, uint256 amount);

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
     * @notice switch the address of shutdown related smart contracts
     * @param which Name of the smart contract
     * @param newAddress New address of the smart contract
     */
    function switchAddress(bytes32 which, address newAddress) external onlyWhenNotInShutdown onlyBy("gov") {
        emit ContractAddressChanged(which, newAddress);
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
     * @notice Change the waiting period to allow certain actions in the system to properly take place
     * @param which The name of the variable to change
     * @param newWaitPeriod New value for the wait period
     */
    function changeWaitPeriod(bytes32 which, uint256 newWaitPeriod) external onlyBy("gov") {
        emit WaitPeriodChanged(which, newWaitPeriod);
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

        uint256 lendingPoolDebt = vaultEngine.lendingPoolDebt();
        uint256 lendingPoolEquity = vaultEngine.lendingPoolEquity();
        if (lendingPoolEquity != 0) {
            finalUtilizationRatio = Math._min(Math._wdiv(lendingPoolDebt, lendingPoolEquity), WAD);
        }

        emit ShutdownInitiated();
    }

    /**
     * @notice Sets the final price for the given asset
     * @param assetId The ID of the asset to finalize the price of
     */
    function setFinalPrice(bytes32 assetId) external onlyWhenInShutdown {
        uint256 price = priceFeed.getPrice(assetId);
        require(price != 0, "Shutdown/setFinalPrice: Price retrieved is zero");
        (, assets[assetId].normDebt, , , ) = vaultEngine.assets(assetId);
        assets[assetId].finalPrice = price;

        emit FinalPriceSet(assetId, price);
    }

    /**
     * @notice Cancels outstanding debt, collects the appropriate amount of collateral, & frees excess collateral
     * @param assetId The ID of the vault asset
     * @param user The address of the vault user
     */
    function processUserDebt(bytes32 assetId, address user) external onlyIfFinalPriceSet(assetId) {
        (, , uint256 collateral, uint256 debt, , ) = vaultEngine.vaults(assetId, user);
        uint256 debtAccumulator = vaultEngine.debtAccumulator();

        uint256 required = (debt * debtAccumulator) / assets[assetId].finalPrice;
        uint256 amountToGrab = Math._min(collateral, required);
        uint256 gap = required - amountToGrab;
        assets[assetId].gap += gap;
        systemCurrencyGap += gap * assets[assetId].finalPrice;

        vaultEngine.liquidateDebtPosition(
            assetId,
            user,
            address(this),
            address(this),
            -int256(amountToGrab),
            -int256(debt)
        );

        emit DebtPositionProcessed(assetId, user, gap, gap * assets[assetId].finalPrice);
    }

    /**
     * @notice Allow users to collect underlying assets that is above what is needed to cover their equity position
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
     * @notice Uses the system reserve to write off current system debt
     */
    function writeOffFromReserves() external onlyWhenInShutdown {
        require(
            vaultEngine.systemDebt(address(reservePool)) == 0,
            "shutdown/writeOffFromReserves: the system debt needs to be zero before write off can happen"
        );
        uint256 reserveBalance = vaultEngine.systemCurrency(address(reservePool));
        uint256 amountToMove = Math._min(systemCurrencyGap, reserveBalance);
        vaultEngine.moveSystemCurrency(address(reservePool), address(this), amountToMove);
        systemCurrencyGap -= amountToMove;
    }

    /**
     * @notice Calculate the investor's obligation ratio to cover the systemCurrency Gap created by
     *         undercollateralized debt positions
     */
    function calculateInvestorObligation() external onlyWhenInShutdown {
        // assumptions:
        //    - all under-collateralized vaults have been processed
        //    - all outstanding auctions are over

        require(
            finalSystemCurrencyBalance != 0,
            "shutdown/calculateInvestorObligation: finalSystemCurrencyBalance must be set first"
        );

        require(
            systemCurrencyGap == 0 || vaultEngine.systemCurrency(address(reservePool)) == 0,
            "shutdown/calculateInvestorObligation: system reserve or systemCurrency gap must be zero"
        );
        uint256 systemCurrencyUtilized = (vaultEngine.lendingPoolEquity() / WAD) * finalUtilizationRatio;
        investorObligationRatio = Math._min((systemCurrencyGap * WAD) / systemCurrencyUtilized, WAD);

        emit InvestorObligationCalculated(investorObligationRatio);
    }

    /**
     * @notice Process equity positions to cover systemCurrency Gap created by undercollateralized debt positions
     * @param assetId The ID of the asset to process
     * @param user The address of the user vault to process
     */
    function processUserEquity(bytes32 assetId, address user) external {
        require(investorObligationRatio != 0, "Shutdown/processUserEquity: Investor has no obligation");

        (, uint256 underlying, , , uint256 normEquity, uint256 initialEquity) = vaultEngine.vaults(assetId, user);
        uint256 hookedSuppliedAmount = (initialEquity / WAD) * finalUtilizationRatio;
        uint256 investorObligation = ((hookedSuppliedAmount * investorObligationRatio) / WAD) /
            assets[assetId].finalPrice;
        uint256 amountToGrab = Math._min(underlying, investorObligation);

        if (amountToGrab > assets[assetId].gap) {
            amountToGrab = assets[assetId].gap;
        }

        assets[assetId].gap -= amountToGrab;
        systemCurrencyGap -= amountToGrab * assets[assetId].finalPrice;

        vaultEngine.liquidateEquityPosition(
            assetId,
            user,
            address(treasury),
            0,
            -int256(underlying),
            -int256(normEquity),
            -int256(initialEquity)
        );

        emit EquityPositionProcessed(assetId, user, amountToGrab, amountToGrab * assets[assetId].finalPrice);
    }

    /**
     * @notice After Auctions have ended, the systemCurrency balance in circulation should no longer change
     */
    function setFinalSystemCurrencyBalance() external onlyWhenInShutdown {
        require(finalSystemCurrencyBalance == 0, "shutdown/setFinalSystemCurrencyBalance: Balance already set");
        require(
            block.timestamp >= initiatedAt + auctionWaitPeriod,
            "shutdown/setFinalSystemCurrencyBalance: Waiting for auctions to complete"
        );
        require(
            vaultEngine.systemDebt(address(reservePool)) == 0 || vaultEngine.systemCurrency(address(reservePool)) == 0,
            "shutdown/setFinalSystemCurrencyBalance: system reserve or debt must be zero"
        );

        finalSystemCurrencyBalance = vaultEngine.totalSystemCurrency();

        emit FinalSystemCurrencyBalanceSet(finalSystemCurrencyBalance);
    }

    /**
     * @notice Calculate the redemptionRatio to determine how much of asset should be redeemed for each systemCurrency
     * @param assetId The ID of the asset to be redeemed
     */
    function calculateRedemptionRatio(bytes32 assetId) external {
        require(
            finalSystemCurrencyBalance != 0,
            "shutdown/calculateRedemptionRatio: Must set final debt balance first"
        );
        uint256 debtAccumulator = vaultEngine.debtAccumulator();
        uint256 normDebt = assets[assetId].normDebt;
        uint256 max = (normDebt * debtAccumulator) / assets[assetId].finalPrice;
        assets[assetId].redemptionRatio = ((max - assets[assetId].gap) * RAY) / (finalSystemCurrencyBalance / RAY);

        emit RedemptionRatioCalculated(assetId, assets[assetId].redemptionRatio);
    }

    /**
     * @notice Return the systemCurrency to shutdown in order to redeem the asset
     * @param amount The Amount to return to shutdown module
     */
    function returnSystemCurrency(uint256 amount) external {
        vaultEngine.moveSystemCurrency(msg.sender, address(this), amount);
        systemCurrency[msg.sender] += amount;

        emit SystemCurrencyReturned(msg.sender, amount);
    }

    /**
     * @notice Based on the amount of systemCurrency returned and redemptionRatio, assset will be given to user
     * @param assetId The AssetId
     */
    function redeemAsset(bytes32 assetId) external {
        // can withdraw collateral returnedSystemCurrency * collateralPerAUR for collateral type
        uint256 redeemAmount = ((systemCurrency[msg.sender] / 1e9) * assets[assetId].redemptionRatio) /
            WAD /
            RAY -
            collRedeemed[assetId][msg.sender];

        collRedeemed[assetId][msg.sender] += redeemAmount;
        vaultEngine.moveAsset(assetId, address(this), msg.sender, redeemAmount);

        emit AssetRedeemed(assetId, msg.sender, redeemAmount);
    }

    /**
     * @notice Set the final systemCurrency balance of reserve pool (if non-zero)
     */
    function setFinalSystemReserve() external {
        require(
            finalSystemCurrencyBalance != 0,
            "shutdown/redeemBondTokens: finalSystemCurrencyBalance must be set first"
        );

        uint256 totalSystemReserve = vaultEngine.systemCurrency(address(reservePool));
        require(totalSystemReserve != 0, "shutdown/setFinalSystemReserve: system reserve is zero");

        finalTotalReserve = totalSystemReserve;
    }

    /**
     * @notice Allows bond holders to redeem for a share of systemCurrency held by ReservePool
     *         up to the token amount
     */
    function redeemBondTokens() external {
        require(finalTotalReserve != 0, "shutdown/redeemBondTokens: finalTotalReserve must be set first");

        uint256 userTokens = bondIssuer.bondTokens(msg.sender);
        uint256 totalBondTokens = bondIssuer.totalBondTokens();

        require(userTokens != 0 && totalBondTokens != 0, "shutdown/redeemBondTokens: no bond tokens to redeem");

        uint256 percentageOfBonds = Math._rdiv(userTokens, totalBondTokens);
        uint256 shareOfSystemCurrency = Math._rmul(percentageOfBonds, finalTotalReserve);

        if (shareOfSystemCurrency > userTokens) {
            shareOfSystemCurrency = userTokens;
        }

        bondIssuer.shutdownRedemption(msg.sender, shareOfSystemCurrency);

        emit BondTokensRedeemed(msg.sender, shareOfSystemCurrency);
    }
}
