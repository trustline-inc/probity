// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";
import "hardhat/console.sol";

/**
 * @title VaultEngine contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 */

contract VaultEngine is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Asset {
        uint256 debtAccumulator; // Cumulative debt rate
        uint256 equityAccumulator; // Cumulative equity rate
        uint256 adjustedPrice; // The asset price, adjusted for the asset liquidation ratio
        uint256 normDebt; // Normalized debt amount
        uint256 normEquity; // Normalized equity amount
        uint256 ceiling; // Max. amount of asset that can be active in a position
        uint256 floor; // Min. amount of asset that must be active to open a position
        Category category; // Type of asset (underlying or collateral)
    }

    struct Vault {
        uint256 standbyAmount; // Asset amount on standby
        uint256 underlying; // Amount covering an equity position
        uint256 collateral; // Amount covering a debt position
        uint256 debt; // Vault debt balance
        uint256 equity; // Vault equity balance
        uint256 initialEquity; // Tracks the amount of equity (less interest)
    }

    enum Category {
        UNDERLYING,
        COLLATERAL,
        BOTH
    }

    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    uint256 public systemCurrencyIssued; // The amount of currency issued by the governance address
    uint256 public lendingPoolSupply; // Total system currency lending pool supply
    uint256 public lendingPoolEquity; // Total shares of equity in the lending pool
    uint256 public lendingPoolDebt; // The amount of system currency owed by borrowers
    uint256 public totalSystemDebt; // Total amount owed to users by Probity
    address[] public vaultList; // List of vaults that had either equity and/or debt position
    mapping(address => bool) public vaultExists; // Boolean indicating whether a vault exists for a given address
    mapping(address => uint256) public systemCurrency; // Vault owner's system currency balance
    mapping(address => uint256) public pbt; // Vault owner's governance token balance
    mapping(address => uint256) public systemDebt; // Vault owner's share of system debt
    mapping(bytes32 => Asset) public assets; // assetId -> asset
    mapping(bytes32 => mapping(address => Vault)) public vaults; // assetId -> vault owner's address -> vault

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event SupplyModified(address indexed issuer, address indexed holder, int256 amount);
    event EquityModified(address indexed account, int256 underlyingAmount, int256 equityAmount);
    event DebtModified(address indexed account, int256 collAmount, int256 debtAmount);
    event InterestCollected(address indexed account, bytes32 assetId, uint256 interestAmount);
    event EquityLiquidated(address indexed account, int256 assetToAuction, int256 assetToReturn, int256 equityAmount);
    event DebtLiquidated(address indexed account, int256 collAmount, int256 debtAmount);
    event SystemDebtSettled(address indexed caller, uint256 amount);
    event SystemDebtIncreased(address indexed caller, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) Stateful(registryAddress) {}

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @dev returns the list of keys for the vaults
     */
    function getVaultList() external view returns (address[] memory list) {
        return vaultList;
    }

    /**
     * @dev returns the calculated balances of the account's positions
     * @param assetId the asset ID
     * @param account the vault owner's address
     */
    function balanceOf(bytes32 assetId, address account)
        external
        view
        returns (
            uint256 underlying,
            uint256 collateral,
            uint256 debt,
            uint256 equity
        )
    {
        Vault storage vault = vaults[assetId][account];
        Asset storage asset = assets[assetId];

        return (
            vault.underlying * asset.adjustedPrice,
            vault.collateral * asset.adjustedPrice,
            vault.debt * asset.debtAccumulator,
            vault.equity * asset.equityAccumulator
        );
    }

    /**
     * @dev Modifies a vault's standby asset balance.
     * @param assetId The asset ID
     * @param account The address of the vault owner
     * @param amount The amount of asset to modify
     */
    function modifyStandbyAmount(
        bytes32 assetId,
        address account,
        int256 amount
    ) external onlyByProbity {
        vaults[assetId][account].standbyAmount = Math._add(vaults[assetId][account].standbyAmount, amount);
    }

    /**
     * @dev Moves asset between vaults.
     * @param assetId The asset ID
     * @param from The address of the originating vault owner
     * @param to The address of the beneficiary vault owner
     * @param amount The amount of asset to move
     */
    function moveAsset(
        bytes32 assetId,
        address from,
        address to,
        uint256 amount
    ) external onlyByProbity {
        vaults[assetId][from].standbyAmount -= amount;
        vaults[assetId][to].standbyAmount += amount;
    }

    /**
     * @dev Moves stablecoin between vaults.
     * @param from The address of the originating vault owner
     * @param to The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to move
     */
    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external onlyByProbity {
        systemCurrency[from] -= amount;
        systemCurrency[to] += amount;
    }

    /**
     * @dev Add stablecoin to account vault.
     * @param account The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to add
     */
    function addStablecoin(address account, uint256 amount) external onlyBy("treasury") {
        systemCurrency[account] += amount;
    }

    /**
     * @dev Remove stablecoin from account vault.
     * @param account The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to remove
     */
    function removeStablecoin(address account, uint256 amount) external onlyByProbity {
        systemCurrency[account] -= amount;
    }

    /**
     * @dev Reduce an account's PBT balance.
     * @param account The address of the vault to reduce PBT from.
     * @param amount The amount of PBT to reduce.
     */
    function reducePbt(address account, uint256 amount) external onlyBy("treasury") {
        pbt[account] -= amount;
    }

    /**
     * @dev Accrues vault interest and PBT
     * @param assetId The ID of the vault asset type
     */
    function collectInterest(bytes32 assetId) public {
        Vault memory vault = vaults[assetId][msg.sender];
        Asset memory asset = assets[assetId];
        uint256 interestAmount = vault.equity * asset.equityAccumulator - vault.initialEquity;
        pbt[msg.sender] += interestAmount;
        systemCurrency[msg.sender] += interestAmount;

        lendingPoolSupply += interestAmount;

        // @todo evaluate how loss of precision can impact here
        vaults[assetId][msg.sender].equity -= interestAmount / asset.equityAccumulator;

        emit InterestCollected(msg.sender, assetId, interestAmount);
    }

    /**
     * @notice Adds equity to the caller's vault
     * @param assetId The ID of the asset type being modified
     * @param treasuryAddress A registered treasury contract address
     * @param underlyingAmount The amount of asset to add
     * @param equityAmount The amount of equity to add
     */
    function modifyEquity(
        bytes32 assetId,
        address treasuryAddress,
        int256 underlyingAmount,
        int256 equityAmount
    ) external virtual onlyBy("whitelisted") {
        _modifyEquity(assetId, treasuryAddress, underlyingAmount, equityAmount);
    }

    /**
     * @notice Modifies vault debt
     * @param assetId The ID of the vault asset type
     * @param treasuryAddress The address of the desired treasury contract
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of stablecoin to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) external virtual onlyBy("whitelisted") {
        _modifyDebt(assetId, treasuryAddress, collAmount, debtAmount);
    }

    /**
     * @notice Liquidates an debt position
     * @param assetId The ID of the vault asset type
     * @param account The address of the vault to liquidate
     * @param auctioneer The address of the desired auctioneer contract
     * @param reservePool The address of the desired reserve pool contract
     * @param collateralAmount The amount of collateral to liquidate
     * @param debtAmount The amount of debt to clear
     */
    function liquidateDebtPosition(
        bytes32 assetId,
        address account,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount
    ) external onlyByProbity {
        Vault storage vault = vaults[assetId][account];
        Asset storage asset = assets[assetId];

        vault.collateral = Math._add(vault.collateral, collateralAmount);
        vault.debt = Math._add(vault.debt, debtAmount);
        asset.normDebt = Math._add(asset.normDebt, debtAmount);

        // Auction off collateral expecting to raise at least fundraiseTarget amount
        int256 fundraiseTarget = Math._mul(asset.debtAccumulator, debtAmount);
        lendingPoolDebt = Math._add(lendingPoolDebt, fundraiseTarget);
        vaults[assetId][auctioneer].standbyAmount = Math._sub(
            vaults[assetId][auctioneer].standbyAmount,
            collateralAmount
        );

        // Assign the vault debt to the reservePool
        systemDebt[reservePool] = Math._sub(systemDebt[reservePool], fundraiseTarget);
        totalSystemDebt = Math._sub(totalSystemDebt, fundraiseTarget);

        emit DebtLiquidated(account, collateralAmount, debtAmount);
    }

    /**
     * @notice Liquidates an equity position
     * @dev Returns underlying asset to account vault with penalty
     * @param assetId The ID of the vault asset type
     * @param account The address of the vault to liquidate
     * @param auctioneer The address of the auctioneer to auction the asset
     * @param assetToAuction The amount of asset sent to auctioneer to be auctioned
     * @param assetToReturn The amount of asset to sent back to owner
     * @param equityAmount The amount of equity to clear
     */
    function liquidateEquityPosition(
        bytes32 assetId,
        address account,
        address auctioneer,
        int256 assetToAuction,
        int256 assetToReturn,
        int256 equityAmount,
        int256 initialEquityAmount
    ) external onlyByProbity {
        Vault storage vault = vaults[assetId][account];
        Asset storage asset = assets[assetId];

        vault.underlying = Math._add(vault.underlying, assetToReturn);
        vault.standbyAmount = Math._sub(vault.standbyAmount, assetToReturn);
        vault.equity = Math._add(vault.equity, equityAmount);
        vault.initialEquity = Math._add(vault.initialEquity, initialEquityAmount);
        asset.normEquity = Math._add(asset.normEquity, equityAmount);

        vaults[assetId][auctioneer].standbyAmount = Math._sub(
            vaults[assetId][auctioneer].standbyAmount,
            assetToAuction
        );
        lendingPoolEquity = Math._add(lendingPoolEquity, Math._mul(RAY, equityAmount));

        emit EquityLiquidated(account, assetToAuction, assetToReturn, equityAmount);
    }

    /**
     * @notice Used for settlement by the reserve pool
     * @param amount The amount to settle
     */
    function settle(uint256 amount) external onlyByProbity {
        systemCurrency[msg.sender] -= amount;
        systemDebt[msg.sender] -= amount;
        lendingPoolSupply -= amount;

        emit SystemDebtSettled(msg.sender, amount);
    }

    /**
     * @notice Increases the system debt
     * @param amount The amount of the debt increase
     * @dev Called by ReservePool
     */
    function increaseSystemDebt(uint256 amount) external onlyByProbity {
        systemCurrency[msg.sender] += amount;
        systemDebt[msg.sender] += amount;
        lendingPoolSupply += amount;

        emit SystemDebtIncreased(msg.sender, amount);
    }

    /// Admin-related functions

    /**
     * @dev Initializes a new asset type
     * @param assetId The asset type ID
     * @param category The asset category
     */
    function initAsset(bytes32 assetId, Category category) external onlyBy("gov") {
        require(assets[assetId].debtAccumulator == 0, "VaultEngine/initAsset: This asset has already been initialized");
        assets[assetId].debtAccumulator = RAY;
        assets[assetId].equityAccumulator = RAY;
        assets[assetId].category = category;
    }

    /**
     * @dev Updates an asset's debt ceiling
     * @param assetId The asset type ID
     * @param ceiling The new ceiling amount
     */
    function updateCeiling(bytes32 assetId, uint256 ceiling) external onlyBy("gov") {
        emit LogVarUpdate("Vault", assetId, "ceiling", assets[assetId].ceiling, ceiling);
        assets[assetId].ceiling = ceiling;
    }

    /**
     * @notice Updates an asset's debt floor
     * @dev Prevent accounts from creating multiple vaults with very low debt amount and asset
     * @param assetId The asset type ID
     * @param floor The new floor amount
     */
    function updateFloor(bytes32 assetId, uint256 floor) external onlyBy("gov") {
        emit LogVarUpdate("Vault", assetId, "floor", assets[assetId].floor, floor);
        assets[assetId].floor = floor;
    }

    /**
     * @dev Updates cumulative indices for the specified asset type
     * @param assetId The asset type ID
     * @param reservePool The address of the reserve pool
     * @param debtRateIncrease The new rate to increase for debt
     * @param equityRateIncrease The new rate to increase for equity
     * @param protocolFeeRates The new protocol fee rates
     */
    function updateAccumulators(
        bytes32 assetId,
        address reservePool,
        uint256 debtRateIncrease,
        uint256 equityRateIncrease,
        uint256 protocolFeeRates
    ) external onlyBy("teller") {
        emit LogVarUpdate("Vault", assetId, "debtAccumulator", assets[assetId].debtAccumulator, debtRateIncrease);
        emit LogVarUpdate("Vault", assetId, "equityAccumulator", assets[assetId].equityAccumulator, equityRateIncrease);
        console.log("debtRateIncrease", debtRateIncrease);
        console.log("equityRateIncrease", equityRateIncrease);
        Asset storage asset = assets[assetId];
        // uint256 newDebt = asset.normDebt * debtRateIncrease;
        // uint256 newEquity = asset.normEquity * equityRateIncrease;

        asset.debtAccumulator += debtRateIncrease;
        asset.equityAccumulator += equityRateIncrease;
        console.log("asset.debtAccumulator", asset.debtAccumulator);
        console.log("asset.equityAccumulator", asset.equityAccumulator);

        uint256 protocolFeeToCollect = asset.normEquity * protocolFeeRates;
        // require(
        //     newEquity + protocolFeeToCollect <= newDebt,
        //     "VaultEngine/updateAccumulators: The equity rate increase is larger than the debt rate increase"
        // );
        systemCurrency[reservePool] += protocolFeeToCollect;
    }

    /**
     * @dev Updates the price of a asset type
     * @param assetId The asset type ID
     * @param price The new price
     */
    function updateAdjustedPrice(bytes32 assetId, uint256 price) external onlyByProbity {
        emit LogVarUpdate("Vault", assetId, "price", assets[assetId].adjustedPrice, price);
        assets[assetId].adjustedPrice = price;
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    function _modifyEquity(
        bytes32 assetId,
        address treasuryAddress,
        int256 underlyingAmount,
        int256 equityAmount
    ) internal {
        require(
            assets[assetId].category == Category.UNDERLYING || assets[assetId].category == Category.BOTH,
            "Vault/modifyEquity: Asset not allowed as underlying"
        );
        require(registry.checkRole("treasury", treasuryAddress), "Vault/modifyEquity: Treasury address is not valid");

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        Vault storage vault = vaults[assetId][msg.sender];
        vault.standbyAmount = Math._sub(vault.standbyAmount, underlyingAmount);
        vault.underlying = Math._add(vault.underlying, underlyingAmount);
        int256 equityCreated = Math._mul(assets[assetId].equityAccumulator, equityAmount);
        vault.equity = Math._add(vault.equity, equityAmount);
        vault.initialEquity = Math._add(vault.initialEquity, equityCreated);

        assets[assetId].normEquity = Math._add(assets[assetId].normEquity, equityAmount);

        lendingPoolEquity = Math._add(lendingPoolEquity, equityCreated);

        require(lendingPoolEquity <= assets[assetId].ceiling, "Vault/modifyEquity: Supply ceiling reached");
        require(
            vault.equity == 0 || (vault.equity * RAY) > assets[assetId].floor,
            "Vault/modifyEquity: Equity smaller than floor"
        );
        _certifyEquityPosition(assetId, vault);

        systemCurrency[treasuryAddress] = Math._add(systemCurrency[treasuryAddress], equityCreated);

        emit EquityModified(msg.sender, underlyingAmount, equityCreated);
    }

    function _modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) internal {
        require(
            assets[assetId].category == Category.COLLATERAL || assets[assetId].category == Category.BOTH,
            "Vault/modifyDebt: Asset not allowed as collateral"
        );
        require(registry.checkRole("treasury", treasuryAddress), "Vault/modifyDebt: Treasury address is not valid");

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        if (debtAmount > 0) {
            require(
                systemCurrency[treasuryAddress] >= uint256(debtAmount),
                "Vault/modifyDebt: Treasury doesn't have enough equity to loan this amount"
            );
        }

        Vault memory vault = vaults[assetId][msg.sender];
        vault.standbyAmount = Math._sub(vault.standbyAmount, collAmount);
        vault.collateral = Math._add(vault.collateral, collAmount);
        int256 debtCreated = Math._mul(assets[assetId].debtAccumulator, debtAmount);
        vault.debt = Math._add(vault.debt, debtAmount);

        assets[assetId].normDebt = Math._add(assets[assetId].normDebt, debtAmount);

        lendingPoolDebt = Math._add(lendingPoolDebt, debtCreated);
        lendingPoolSupply = Math._add(lendingPoolSupply, debtCreated);

        require(lendingPoolDebt <= assets[assetId].ceiling, "Vault/modifyDebt: Debt ceiling reached");
        require(
            vault.debt == 0 || (vault.debt * RAY) > assets[assetId].floor,
            "Vault/modifyDebt: Debt smaller than floor"
        );
        _certifyDebtPosition(assetId, vault);

        systemCurrency[msg.sender] = Math._add(systemCurrency[msg.sender], debtCreated);
        systemCurrency[treasuryAddress] = Math._sub(systemCurrency[treasuryAddress], debtCreated);

        vaults[assetId][msg.sender] = vault;

        emit DebtModified(msg.sender, collAmount, debtCreated);
    }

    /**
     * @dev Certifies that the vault meets the asset requirement
     * @param assetId The asset type ID
     * @param vault The vault to certify
     */
    function _certifyEquityPosition(bytes32 assetId, Vault memory vault) internal view {
        require(
            vault.initialEquity <= vault.underlying * assets[assetId].adjustedPrice,
            "Vault/certify: Not enough underlying"
        );
    }

    /**
     * @dev Certifies that the vault meets the asset requirement
     * @param assetId The asset type ID
     * @param vault The vault to certify
     */
    function _certifyDebtPosition(bytes32 assetId, Vault memory vault) internal view {
        require(
            (vault.debt * assets[assetId].debtAccumulator) <= vault.collateral * assets[assetId].adjustedPrice,
            "Vault/certify: Not enough collateral"
        );
    }
}
