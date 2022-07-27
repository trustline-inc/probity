// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";

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
    struct Vault {
        uint256 standby; // Assets that are on standby [WAD]
        uint256 underlying; // Amount covering an equity position [WAD]
        uint256 collateral; // Amount covering a debt position [WAD]
        uint256 debt; // Vault debt balance [WAD]
        uint256 equity; // Vault equity balance [WAD]
        uint256 initialEquity; // Tracks the amount of equity (less interest) [RAD]
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
    uint256 private constant RAY = 10**27;

    address public treasury;
    uint256 public debtAccumulator; // Cumulative debt rate [RAY]
    uint256 public equityAccumulator; // Cumulative equity rate [RAY]
    uint256 public systemCurrencyIssued; // The amount of currency issued by the governance address [RAD]
    uint256 public lendingPoolSupply; // Total system currency lending pool supply [RAD]
    uint256 public lendingPoolEquity; // Total normalized shares of equity in the lending pool [RAD]
    uint256 public lendingPoolDebt; // The normalized amount of system currency owed by borrowers [RAD]
    uint256 public totalSystemDebt; // Total amount owed to users by Probity [RAD]
    address[] public vaultList; // List of vaults that had either equity and/or debt position
    mapping(address => bool) public vaultExists; // Boolean indicating whether a vault exists for a given address
    mapping(address => uint256) public systemCurrency; // Vault owner's system currency balance [RAD]
    mapping(address => uint256) public pbt; // Vault owner's governance token balance [RAD]
    mapping(address => uint256) public systemDebt; // Vault owner's share of system debt [RAD]
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
    constructor(address registryAddress) Stateful(registryAddress) {
        debtAccumulator = RAY;
        equityAccumulator = RAY;
    }

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
     * @dev update the treasuryAddress
     * @param newTreasuryAddress to use
     */
    function updateTreasuryAddress(address newTreasuryAddress) external {
        require(registry.checkRole("treasury", newTreasuryAddress), "Treasury address is not valid");

        treasury = newTreasuryAddress;
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
            vault.debt * debtAccumulator,
            vault.equity * equityAccumulator
        );
    }

    /**
     * @dev Modifies a vault's standby asset balance.
     * @param asset The asset ID
     * @param account The address of the vault owner
     * @param amount The amount of asset to modify
     */
    function modifyStandbyAsset(
        bytes32 asset,
        address account,
        int256 amount
    ) external onlyByProbity {
        vaults[asset][account].standby = Math._add(vaults[asset][account].standby, amount);
    }

    /**
     * @dev Moves asset between vaults.
     * @param asset The asset ID
     * @param from The address of the originating vault owner
     * @param to The address of the beneficiary vault owner
     * @param amount The amount of asset to move
     */
    function moveAsset(
        bytes32 asset,
        address from,
        address to,
        uint256 amount
    ) external onlyByProbity {
        vaults[asset][from].standby -= amount;
        vaults[asset][to].standby += amount;
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

    //    @todo commented out to be re-assessed if this is still relevant
    //    /**
    //     * @dev Accrues vault interest and PBT
    //     * @param assetId The ID of the vault asset type
    //     */
    //    function collectInterest(bytes32 assetId) public {
    //        Vault memory vault = vaults[assetId][msg.sender];
    //        Asset memory asset = assets[assetId];
    //        uint256 interestAmount = vault.equity * equityAccumulator - vault.initialEquity;
    //        pbt[msg.sender] += interestAmount;
    //        systemCurrency[msg.sender] += interestAmount;
    //
    //        lendingPoolSupply += interestAmount;
    //
    //        // @todo evaluate how loss of precision can impact here
    //        vaults[assetId][msg.sender].equity -= interestAmount / equityAccumulator;
    //
    //        emit InterestCollected(msg.sender, assetId, interestAmount);
    //    }

    /**
     * @notice Adds equity to the caller's vault
     * @param assetId The ID of the asset type being modified
     * @param underlyingAmount The amount of asset to add
     * @param equityAmount The amount of equity to add
     */
    function modifyEquity(
        bytes32 assetId,
        int256 underlyingAmount,
        int256 equityAmount
    ) external virtual onlyBy("whitelisted") {
        _modifyEquity(assetId, underlyingAmount, equityAmount);
    }

    /**
     * @notice Modifies vault debt
     * @param assetId The ID of the vault asset type
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of stablecoin to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        int256 collAmount,
        int256 debtAmount
    ) external virtual onlyBy("whitelisted") {
        _modifyDebt(assetId, collAmount, debtAmount);
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
        int256 fundraiseTarget = Math._mul(debtAccumulator, debtAmount);
        lendingPoolDebt = Math._add(lendingPoolDebt, debtAmount);
        vaults[assetId][auctioneer].standby = Math._sub(vaults[assetId][auctioneer].standby, collateralAmount);

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
        vault.standby = Math._sub(vault.standby, assetToReturn);
        vault.equity = Math._add(vault.equity, equityAmount);
        vault.initialEquity = Math._add(vault.initialEquity, initialEquityAmount);
        asset.normEquity = Math._add(asset.normEquity, equityAmount);

        vaults[assetId][auctioneer].standby = Math._sub(vaults[assetId][auctioneer].standby, assetToAuction);
        lendingPoolEquity = Math._add(lendingPoolEquity, equityAmount);

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
     * @param debtRateIncrease The new rate to increase for debt
     * @param equityRateIncrease The new rate to increase for equity
     */
    function updateAccumulators(
        bytes32 assetId,
        address reservePool,
        uint256 debtRateIncrease,
        uint256 equityRateIncrease,
        uint256 protocolFeeRates
    ) external onlyBy("teller") {
        require(treasury != address(0), "VaultEngine/updateAccumulators: treasury address is not set");
        emit LogVarUpdate("Vault", assetId, "debtAccumulator", debtAccumulator, debtRateIncrease);
        emit LogVarUpdate("Vault", assetId, "equityAccumulator", equityAccumulator, equityRateIncrease);

        Asset storage asset = assets[assetId];
        uint256 newDebt = lendingPoolDebt * debtRateIncrease;
        uint256 newEquity = lendingPoolEquity * equityRateIncrease;

        debtAccumulator += debtRateIncrease;
        equityAccumulator += equityRateIncrease;

        uint256 protocolFeeToCollect = asset.normEquity * protocolFeeRates;
        require(
            newEquity + protocolFeeToCollect <= newDebt,
            "VaultEngine/updateAccumulators: The equity rate increase is larger than the debt rate increase"
        );

        systemCurrency[treasury] += newEquity;
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
        int256 underlyingAmount,
        int256 equityAmount
    ) internal {
        require(treasury != address(0), "VaultEngine/updateAccumulators: treasury address is not set");
        require(
            assets[assetId].category == Category.UNDERLYING || assets[assetId].category == Category.BOTH,
            "Vault/modifyEquity: Asset not allowed as underlying"
        );

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        Vault storage vault = vaults[assetId][msg.sender];
        vault.standby = Math._sub(vault.standby, underlyingAmount);
        vault.underlying = Math._add(vault.underlying, underlyingAmount);
        int256 equityCreated = Math._mul(equityAccumulator, equityAmount);
        vault.equity = Math._add(vault.equity, equityAmount);
        vault.initialEquity = Math._add(vault.initialEquity, equityCreated);

        assets[assetId].normEquity = Math._add(assets[assetId].normEquity, equityAmount);

        lendingPoolEquity = Math._add(lendingPoolEquity, equityAmount);

        require(
            lendingPoolEquity * equityAccumulator <= assets[assetId].ceiling,
            "Vault/modifyEquity: Supply ceiling reached"
        );
        require(
            vault.equity == 0 || (vault.equity * RAY) > assets[assetId].floor,
            "Vault/modifyEquity: Equity smaller than floor"
        );
        _certifyEquityPosition(assetId, vault);

        systemCurrency[treasury] = Math._add(systemCurrency[treasury], equityCreated);

        emit EquityModified(msg.sender, underlyingAmount, equityCreated);
    }

    function _modifyDebt(
        bytes32 assetId,
        int256 collAmount,
        int256 debtAmount
    ) internal {
        require(treasury != address(0), "VaultEngine/updateAccumulators: treasury address is not set");
        require(
            assets[assetId].category == Category.COLLATERAL || assets[assetId].category == Category.BOTH,
            "Vault/modifyDebt: Asset not allowed as collateral"
        );

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        if (debtAmount > 0) {
            require(
                systemCurrency[treasury] >= uint256(debtAmount),
                "Vault/modifyDebt: Treasury doesn't have enough equity to loan this amount"
            );
        }

        Vault memory vault = vaults[assetId][msg.sender];
        vault.standby = Math._sub(vault.standby, collAmount);
        vault.collateral = Math._add(vault.collateral, collAmount);
        int256 debtCreated = Math._mul(debtAccumulator, debtAmount);
        vault.debt = Math._add(vault.debt, debtAmount);

        assets[assetId].normDebt = Math._add(assets[assetId].normDebt, debtAmount);

        lendingPoolDebt = Math._add(lendingPoolDebt, debtAmount);
        lendingPoolSupply = Math._add(lendingPoolSupply, debtCreated);

        require(lendingPoolDebt * debtAccumulator <= assets[assetId].ceiling, "Vault/modifyDebt: Debt ceiling reached");
        require(
            vault.debt == 0 || (vault.debt * RAY) > assets[assetId].floor,
            "Vault/modifyDebt: Debt smaller than floor"
        );
        _certifyDebtPosition(assetId, vault);

        systemCurrency[msg.sender] = Math._add(systemCurrency[msg.sender], debtCreated);
        systemCurrency[treasury] = Math._sub(systemCurrency[treasury], debtCreated);

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
            (vault.debt * debtAccumulator) <= vault.collateral * assets[assetId].adjustedPrice,
            "Vault/certify: Not enough collateral"
        );
    }
}
