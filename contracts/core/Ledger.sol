// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "../deps/Stateful.sol";
import "../deps/Eventful.sol";
import "../deps/Math.sol";

/**
 * @title Ledger contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 */

contract Ledger is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Account {
        uint256 balance; // Collateral amount on standby [WAD]
        uint256 underlying; // Amount invested [WAD]
        uint256 collateral; // Amount covering a debt position [WAD]
        uint256 normDebt; // Normalized debt balance [WAD]
        uint256 normEquity; // Normalized equity balance [WAD]
        uint256 initialEquity; // Tracks the amount of equity (less interest) [RAD]
        uint256 debtPrincipal; // Tracks the principal amount of debt
    }

    enum Category {
        UNDERLYING,
        COLLATERAL,
        BOTH
    }

    struct Asset {
        uint256 adjustedPrice; // The asset price, adjusted for the asset liquidation ratio [RAY]
        uint256 normDebt; // Normalized debt amount [WAD]
        uint256 normEquity; // Normalized equity amount [WAD]
        uint256 ceiling; // Max. amount of asset that can be active in a position [RAD]
        uint256 floor; // Min. amount of asset that must be active to open a position [RAD]
        Category category; // Type of asset (underlying or collateral)
    }

    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10 ** 27;

    address public comptroller;
    uint256 public rateForDebt; // Cumulative debt rate [RAY]
    uint256 public rateForEquity; // Cumulative equity rate [RAY]
    uint256 public issuedBalance; // The amount of dollars issued by the admin address [RAD]
    uint256 public totalBalance; // Total dollar balance (outstanding debt + unutilized funds) [RAD]
    uint256 public totalShares; // Total normalized totalShares of equity in the lending pool [RAD]
    uint256 public totalLoanBalance; // Total normalized amount of system currency owed by borrowers [RAD]
    uint256 public totalDebtBalance; // Total amount of debt, including written-off loans [RAD]
    uint256 public availableFunds; // Total amount of system currency in lending pool w/o interest [RAD]
    uint256 public totalDebtPrincipal; // Total amount of loan principal (w/o interest) [RAD]
    address[] public participants; // List of accounts that had either equity and/or debt position
    mapping(address => bool) public positionExists; // Boolean indicating whether a account exists for a given address
    mapping(address => uint256) public balance; // Account owner's system currency balance [RAD]
    mapping(address => uint256) public systemDebt; // Account owner's share of system debt [RAD]
    mapping(bytes32 => Asset) public assets; // assetId -> asset
    mapping(bytes32 => mapping(address => Account)) public accounts; // assetId -> account owner's address -> account

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event SupplyModified(address indexed issuer, address indexed holder, int256 amount);
    event EquityModified(address indexed account, int256 amount, int256 shares);
    event DebtModified(address indexed account, int256 collAmount, int256 debtAmount);
    event InterestCollected(address indexed account, bytes32 assetId, uint256 interestAmount);
    event EquityLiquidated(address indexed account, int256 assetToAuction, int256 assetToReturn, int256 shares);
    event DebtLiquidated(address indexed account, int256 collAmount, int256 debtAmount);
    event SystemDebtSettled(address indexed caller, uint256 amount);
    event SystemDebtIncreased(address indexed caller, uint256 amount);

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error comptrollerAddressNotSet();
    error insufficientUnderlyingAsset();
    error insufficientCollateralAsset();
    error equityCreatedCanNotBeGreaterThanDebtCreated();
    error assetNotAllowedAsCollateral();
    error assetNotAllowedAsUnderlying();
    error insufficientFundInComptroller();
    error accountSizeMinimumNotReached();
    error assetMaximumAmountReached();

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registry) Stateful(registry) {
        rateForDebt = RAY;
        rateForEquity = RAY;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @dev returns the list of keys for the accounts
     */
    function getOwners() external view returns (address[] memory list) {
        return participants;
    }

    /**
     * @dev update the comptrollerAddress
     * @param newComptrollerAddress to use
     */
    function updateComptrollerAddress(address newComptrollerAddress) external onlyBy("admin") {
        if (!registry.checkRole("comptroller", newComptrollerAddress)) revert comptrollerAddressNotSet();
        comptroller = newComptrollerAddress;
    }

    /**
     * @dev returns the asset account balances
     * @param assetId the asset ID
     * @param owner the account owner's address
     */
    function balanceOf(
        bytes32 assetId,
        address owner
    ) external view returns (uint256 underlying, uint256 collateral, uint256 debt, uint256 equity) {
        Account storage account = accounts[assetId][owner];
        Asset storage asset = assets[assetId];

        return (
            account.underlying * asset.adjustedPrice,
            account.collateral * asset.adjustedPrice,
            account.normDebt * rateForDebt,
            account.normEquity * rateForEquity
        );
    }

    /**
     * @dev Modifies an account's collateral balance
     * @param assetId The asset ID
     * @param owner The address of the account owner
     * @param amount The amount of asset to modify
     */
    function modifyCollateral(bytes32 assetId, address owner, int256 amount) external onlyByProbity {
        accounts[assetId][owner].balance = Math._add(accounts[assetId][owner].balance, amount);
    }

    /**
     * @dev Transfers collateral between accounts
     * @param assetId The asset ID
     * @param from The owner address of the originating account
     * @param to The owner address of the beneficiary account
     * @param amount The amount of asset to move
     */
    function transferCollateral(bytes32 assetId, address from, address to, uint256 amount) external onlyByProbity {
        accounts[assetId][from].balance -= amount;
        accounts[assetId][to].balance += amount;
    }

    /**
     * @dev Transfers a USD balance between accounts
     * @param from The address of the originating account owner
     * @param to The address of the beneficiary account owner
     * @param amount The amount of balance to move
     */
    function transfer(address from, address to, uint256 amount) external onlyByProbity {
        balance[from] -= amount;
        balance[to] += amount;
    }

    /**
     * @dev Add balance to owner's account
     * @param owner The address of the beneficiary account
     * @param amount The amount of balance to add
     */
    function increase(address owner, uint256 amount) external onlyBy("comptroller") {
        balance[owner] += amount;
    }

    /**
     * @dev Reduce owner's account balance
     * @param owner The address of the originating account
     * @param amount The amount of balance to remove
     */
    function decrease(address owner, uint256 amount) external onlyByProbity {
        balance[owner] -= amount;
    }

    /**
     * @dev Accrues investor interest
     * @param assetId The ID of the account asset type
     */
    function collectInterest(bytes32 assetId) public onlyWhen("paused", false) {
        Account memory account = accounts[assetId][msg.sender];
        uint256 interestAmount = account.normEquity * rateForEquity - account.initialEquity;
        uint256 normEquityToCollect = interestAmount / rateForEquity;

        _collectInterest(assetId, normEquityToCollect * rateForEquity);

        accounts[assetId][msg.sender].normEquity -= normEquityToCollect;
    }

    /**
     * @notice Subscribes to the debt offering
     * @param assetId The ID of the asset type being modified
     * @param amount The amount of asset to add
     * @param shares The amount of equity to add
     */
    function subscribe(bytes32 assetId, int256 amount, int256 shares) external virtual onlyWhen("paused", false) {
        _subscribe(assetId, amount, shares);
    }

    /**
     * @notice Modifies account debt
     * @param assetId The ID of the account asset type
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of balance to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        int256 collAmount,
        int256 debtAmount
    ) external virtual onlyWhen("paused", false) {
        _modifyDebt(assetId, collAmount, debtAmount);
    }

    /**
     * @notice Liquidates an debt position
     * @param assetId The ID of the account asset type
     * @param owner The address of the account to liquidate
     * @param auctioneer The address of the desired auctioneer contract
     * @param reservePool The address of the desired reserve pool contract
     * @param collateralAmount The amount of collateral to liquidate
     * @param debtAmount The amount of debt to clear
     */
    function liquidateDebtAccount(
        bytes32 assetId,
        address owner,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount,
        int256 principalAmount
    ) external onlyByProbity {
        Account storage account = accounts[assetId][owner];
        Asset storage asset = assets[assetId];

        account.collateral = Math._add(account.collateral, collateralAmount);
        account.normDebt = Math._add(account.normDebt, debtAmount);
        asset.normDebt = Math._add(asset.normDebt, debtAmount);
        totalLoanBalance = Math._add(totalLoanBalance, debtAmount);
        totalDebtPrincipal = Math._add(totalDebtPrincipal, principalAmount);
        account.debtPrincipal = Math._add(account.debtPrincipal, principalAmount);

        // Auction off collateral expecting to raise at least fundraiseTarget amount
        int256 fundraiseTarget = Math._mul(rateForDebt, debtAmount);
        accounts[assetId][auctioneer].balance = Math._sub(accounts[assetId][auctioneer].balance, collateralAmount);

        // Assign the account debt to the reservePool
        systemDebt[reservePool] = Math._sub(systemDebt[reservePool], fundraiseTarget);
        totalDebtBalance = Math._sub(totalDebtBalance, fundraiseTarget);

        emit DebtLiquidated(owner, collateralAmount, debtAmount);
    }

    /**
     * @notice Liquidates an equity position
     * @dev Returns underlying asset to account account with penalty
     * @param assetId The ID of the account asset type
     * @param owner The address of the account to liquidate
     * @param auctioneer The address of the auctioneer to auction the asset
     * @param assetToAuction The amount of asset sent to auctioneer to be auctioned
     * @param assetToReturn The amount of asset to sent back to owner
     * @param shares The amount of equity to clear
     */
    function liquidateEquityAccount(
        bytes32 assetId,
        address owner,
        address auctioneer,
        int256 assetToAuction,
        int256 assetToReturn,
        int256 shares,
        int256 initialEquityAmount
    ) external onlyByProbity {
        Account storage account = accounts[assetId][owner];
        Asset storage asset = assets[assetId];

        account.underlying = Math._add(account.underlying, assetToReturn);
        account.balance = Math._sub(account.balance, assetToReturn);
        account.normEquity = Math._add(account.normEquity, shares);
        asset.normEquity = Math._add(asset.normEquity, shares);
        totalShares = Math._add(totalShares, shares);

        accounts[assetId][auctioneer].balance = Math._sub(accounts[assetId][auctioneer].balance, assetToAuction);

        account.initialEquity = Math._add(account.initialEquity, initialEquityAmount);
        availableFunds = Math._add(availableFunds, initialEquityAmount);

        emit EquityLiquidated(owner, assetToAuction, assetToReturn, shares);
    }

    /**
     * @notice Used for settlement by the reserve pool
     * @param amount The amount to settle
     */
    function settle(uint256 amount) external onlyByProbity {
        balance[msg.sender] -= amount;
        systemDebt[msg.sender] -= amount;
        totalBalance -= amount;

        emit SystemDebtSettled(msg.sender, amount);
    }

    /**
     * @notice Increases the system debt
     * @param amount The amount of the debt increase
     * @dev Called by ReservePool
     */
    function increaseSystemDebt(uint256 amount) external onlyByProbity {
        balance[msg.sender] += amount;
        systemDebt[msg.sender] += amount;
        totalBalance += amount;

        emit SystemDebtIncreased(msg.sender, amount);
    }

    /// Admin-related functions

    /**
     * @dev Initializes a new asset type
     * @param assetId The asset type ID
     * @param category The asset category
     */
    function initAsset(bytes32 assetId, Category category) external onlyBy("admin") {
        assets[assetId].category = category;
    }

    /**
     * @dev Updates an asset's debt ceiling
     * @param assetId The asset type ID
     * @param ceiling The new ceiling amount
     */
    function updateCeiling(bytes32 assetId, uint256 ceiling) external onlyBy("admin") {
        emit LogVarUpdate("Account", assetId, "ceiling", assets[assetId].ceiling, ceiling);
        assets[assetId].ceiling = ceiling;
    }

    /**
     * @notice Updates an asset's debt floor
     * @dev Prevent accounts from creating multiple accounts with very low debt amount and asset
     * @param assetId The asset type ID
     * @param floor The new floor amount
     */
    function updateFloor(bytes32 assetId, uint256 floor) external onlyBy("admin") {
        emit LogVarUpdate("Account", assetId, "floor", assets[assetId].floor, floor);
        assets[assetId].floor = floor;
    }

    /**
     * @dev Updates cumulative indices for the specified asset type
     * @param reservePool The address of the reserve pool
     * @param debtRateIncrease The new rate to increase for debt
     * @param equityRateIncrease The new rate to increase for equity
     * @param protocolFeeRates The new protocol fee rates
     */
    function updateAccumulators(
        address reservePool,
        uint256 debtRateIncrease,
        uint256 equityRateIncrease,
        uint256 protocolFeeRates
    ) external onlyBy("teller") {
        if (comptroller == address(0)) revert comptrollerAddressNotSet();
        emit LogVarUpdate("Account", "rateForDebt", rateForDebt, debtRateIncrease);
        emit LogVarUpdate("Account", "rateForEquity", rateForEquity, equityRateIncrease);

        uint256 newDebt = totalLoanBalance * debtRateIncrease;
        uint256 newEquity = totalShares * equityRateIncrease;

        rateForDebt += debtRateIncrease;
        rateForEquity += equityRateIncrease;

        uint256 protocolFeeToCollect = totalShares * protocolFeeRates;

        if (newEquity + protocolFeeToCollect > newDebt) revert equityCreatedCanNotBeGreaterThanDebtCreated();

        balance[reservePool] += protocolFeeToCollect;
    }

    /**
     * @dev Updates the price of a asset type
     * @param assetId The asset type ID
     * @param price The new price
     */
    function updateAdjustedPrice(bytes32 assetId, uint256 price) external onlyByProbity {
        emit LogVarUpdate("Account", assetId, "price", assets[assetId].adjustedPrice, price);
        assets[assetId].adjustedPrice = price;
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    function _collectInterest(bytes32 assetId, uint256 interestAmountToCollect) internal {
        balance[msg.sender] += interestAmountToCollect;
        totalBalance += interestAmountToCollect;

        emit InterestCollected(msg.sender, assetId, interestAmountToCollect);
    }

    function _subscribe(bytes32 assetId, int256 amount, int256 shares) internal {
        if (comptroller == address(0)) revert comptrollerAddressNotSet();
        if (assets[assetId].category == Category.COLLATERAL) revert assetNotAllowedAsUnderlying();

        if (!positionExists[msg.sender]) {
            participants.push(msg.sender);
            positionExists[msg.sender] = true;
        }

        Account storage account = accounts[assetId][msg.sender];

        account.balance = Math._sub(account.balance, amount);
        account.underlying = Math._add(account.underlying, amount);
        int256 equityCreated = Math._mul(rateForEquity, shares);

        int256 initialEquityToChange = equityCreated;

        // only reduce initialEquity if
        if (
            equityCreated < 0 && (Math._add(account.normEquity * rateForEquity, equityCreated) < account.initialEquity)
        ) {
            initialEquityToChange = -int256(
                account.initialEquity - Math._add(account.normEquity * rateForEquity, equityCreated)
            );

            uint256 interestToCollect = uint256(-(equityCreated - initialEquityToChange));
            _collectInterest(assetId, interestToCollect);
        }

        account.normEquity = Math._add(account.normEquity, shares);
        account.initialEquity = Math._add(account.initialEquity, initialEquityToChange);

        assets[assetId].normEquity = Math._add(assets[assetId].normEquity, shares);
        totalShares = Math._add(totalShares, shares);
        availableFunds = Math._add(availableFunds, initialEquityToChange);

        if (Math._mul(assets[assetId].normEquity, rateForEquity) > assets[assetId].ceiling)
            revert assetMaximumAmountReached();
        if (account.normEquity != 0 && (account.normEquity * RAY) < assets[assetId].floor)
            revert accountSizeMinimumNotReached();

        _certifyEquityAccount(assetId, account);

        balance[comptroller] = Math._add(balance[comptroller], initialEquityToChange);

        emit EquityModified(msg.sender, amount, equityCreated);
    }

    function _modifyDebt(bytes32 assetId, int256 collAmount, int256 debtAmount) internal {
        if (comptroller == address(0)) revert comptrollerAddressNotSet();
        if (assets[assetId].category == Category.UNDERLYING) revert assetNotAllowedAsCollateral();

        if (!positionExists[msg.sender]) {
            participants.push(msg.sender);
            positionExists[msg.sender] = true;
        }

        int256 debtCreated = Math._mul(rateForDebt, debtAmount);

        if (debtAmount > 0) {
            if (balance[comptroller] < uint256(debtAmount) * rateForDebt) revert insufficientFundInComptroller();
        }

        Account memory account = accounts[assetId][msg.sender];

        // Reduce the debt principal only after interests are paid off
        int256 principalToChange = debtCreated;
        if (debtCreated < 0 && (Math._add(account.normDebt * rateForDebt, debtCreated) < account.debtPrincipal)) {
            principalToChange = -int256(account.debtPrincipal - Math._add(account.normDebt * rateForDebt, debtCreated));
        }

        account.debtPrincipal = Math._add(account.debtPrincipal, principalToChange);
        totalDebtPrincipal = Math._add(totalDebtPrincipal, principalToChange);

        account.balance = Math._sub(account.balance, collAmount);
        account.collateral = Math._add(account.collateral, collAmount);
        account.normDebt = Math._add(account.normDebt, debtAmount);

        assets[assetId].normDebt = Math._add(assets[assetId].normDebt, debtAmount);
        totalLoanBalance = Math._add(totalLoanBalance, debtAmount);

        totalBalance = Math._add(totalBalance, debtCreated);

        if (assets[assetId].normDebt * rateForDebt > assets[assetId].ceiling) revert assetMaximumAmountReached();
        if (account.normDebt != 0 && (account.normDebt * RAY) < assets[assetId].floor)
            revert accountSizeMinimumNotReached();

        _certifyDebtAccount(assetId, account);

        balance[msg.sender] = Math._add(balance[msg.sender], debtCreated);
        balance[comptroller] = Math._sub(balance[comptroller], principalToChange);

        accounts[assetId][msg.sender] = account;

        emit DebtModified(msg.sender, collAmount, debtCreated);
    }

    /**
     * @dev Certifies that the account meets the asset requirement
     * @param assetId The asset type ID
     * @param account The account to certify
     */
    function _certifyEquityAccount(bytes32 assetId, Account memory account) internal view {
        if (account.initialEquity > account.underlying * assets[assetId].adjustedPrice)
            revert insufficientUnderlyingAsset();
    }

    /**
     * @dev Certifies that the account meets the asset requirement
     * @param assetId The asset type ID
     * @param account The account to certify
     */
    function _certifyDebtAccount(bytes32 assetId, Account memory account) internal view {
        if ((account.normDebt * rateForDebt) > account.collateral * assets[assetId].adjustedPrice)
            revert insufficientCollateralAsset();
    }
}
