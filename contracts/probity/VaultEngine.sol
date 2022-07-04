// SPDX-License-Identifier: MIT

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
        uint256 standby; // Assets that are on standby
        uint256 underlying; // Amount covering an equity position
        uint256 collateral; // Amount covering a debt position
        uint256 debt; // Vault debt balance
        uint256 equity; // Vault equity balance
        uint256 initialEquity; // Tracks the amount of equity (less interest)
    }

    struct Asset {
        uint256 debtAccumulator; // Cumulative debt rate
        uint256 equityAccumulator; // Cumulative equity rate
        uint256 adjustedPrice; // The asset price, adjusted for the asset liquidation ratio
        uint256 normDebt; // Normalized debt amount
        uint256 normEquity; // Normalized equity amount
        uint256 ceiling; // Max. amount of asset that can be active in a position
        uint256 floor; // Min. amount of asset that must be active to open a position
    }

    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    uint256 public totalDebt; // Total $ loan amount for all assets
    uint256 public totalStablecoin; // Total stablecoin supply in circulation
    uint256 public totalEquity; // Total equity position for all asset types
    uint256 public totalSystemDebt; // Total system debt
    address[] public vaultList; // List of vaults that had either equity and/or debt position
    mapping(address => bool) public vaultExists; // Boolean indicating whether a vault exists for a given address
    mapping(address => uint256) public stablecoin; // vault owner's stablecoin balance
    mapping(address => uint256) public pbt; // vault owner's governance token balance
    mapping(address => uint256) public systemDebt; // vault owner's share of system debt
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
     * @param asset The asset ID
     * @param account The address of the vault owner
     * @param amount The amount of asset to modify
     */
    function modifyStandbyAsset(
        bytes32 asset,
        address account,
        int256 amount
    ) external onlyByProbity {
        vaults[asset][account].standby = Math.add(vaults[asset][account].standby, amount);
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
        stablecoin[from] -= amount;
        stablecoin[to] += amount;
    }

    /**
     * @dev Add stablecoin to account vault.
     * @param account The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to add
     */
    function addStablecoin(address account, uint256 amount) external onlyBy("treasury") {
        stablecoin[account] += amount;
    }

    /**
     * @dev Remove stablecoin from account vault.
     * @param account The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to remove
     */
    function removeStablecoin(address account, uint256 amount) external onlyByProbity {
        stablecoin[account] -= amount;
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
        stablecoin[msg.sender] += interestAmount;

        totalStablecoin += interestAmount;

        // @todo evaluate how loss of precision can impact here
        vaults[assetId][msg.sender].equity -= interestAmount / asset.equityAccumulator;

        emit InterestCollected(msg.sender, assetId, interestAmount);
    }

    /**
     * @notice Issues stablecoins to an account
     * @param assetId The ID of the asset type being modified
     * @param treasuryAddress A registered treasury contract address
     * @param account The holder of the issued stablecoins
     * @param amount The amount to issue
     */
    function modifySupply(
        bytes32 assetId,
        address treasuryAddress,
        address account,
        int256 amount
    ) external virtual onlyBy("gov") {
        _modifySupply(assetId, treasuryAddress, account, amount);
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

        vault.collateral = Math.add(vault.collateral, collateralAmount);
        vault.debt = Math.add(vault.debt, debtAmount);
        asset.normDebt = Math.add(asset.normDebt, debtAmount);
        int256 fundraiseTarget = Math.mul(asset.debtAccumulator, debtAmount);
        totalDebt = Math.add(totalDebt, fundraiseTarget);

        vaults[assetId][auctioneer].standby = Math.sub(vaults[assetId][auctioneer].standby, collateralAmount);
        systemDebt[reservePool] = Math.sub(systemDebt[reservePool], fundraiseTarget);
        totalSystemDebt = Math.sub(totalSystemDebt, fundraiseTarget);

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

        vault.underlying = Math.add(vault.underlying, assetToReturn);
        vault.standby = Math.sub(vault.standby, assetToReturn);
        vault.equity = Math.add(vault.equity, equityAmount);
        vault.initialEquity = Math.add(vault.initialEquity, initialEquityAmount);
        asset.normEquity = Math.add(asset.normEquity, equityAmount);

        vaults[assetId][auctioneer].standby = Math.sub(vaults[assetId][auctioneer].standby, assetToAuction);
        totalEquity = Math.add(totalEquity, Math.mul(RAY, equityAmount));

        emit EquityLiquidated(account, assetToAuction, assetToReturn, equityAmount);
    }

    /**
     * @notice Used for settlement by the reserve pool
     * @param amount The amount to settle
     */
    function settle(uint256 amount) external onlyByProbity {
        stablecoin[msg.sender] -= amount;
        systemDebt[msg.sender] -= amount;
        totalStablecoin -= amount;

        emit SystemDebtSettled(msg.sender, amount);
    }

    /**
     * @notice Increases the system debt
     * @param amount The amount of the debt increase
     * @dev Called by ReservePool
     */
    function increaseSystemDebt(uint256 amount) external onlyByProbity {
        stablecoin[msg.sender] += amount;
        systemDebt[msg.sender] += amount;
        totalStablecoin += amount;

        emit SystemDebtIncreased(msg.sender, amount);
    }

    /// Admin-related functions

    /**
     * @dev Initializes a new asset type
     * @param assetId The asset type ID
     */
    function initAsset(bytes32 assetId) external onlyBy("gov") {
        require(assets[assetId].debtAccumulator == 0, "VaultEngine/initAsset: This asset has already been initialized");
        assets[assetId].debtAccumulator = RAY;
        assets[assetId].equityAccumulator = RAY;
    }

    /**
     * @dev Updates a asset's debt ceiling
     * @param assetId The asset type ID
     * @param ceiling The new ceiling amount
     */
    function updateCeiling(bytes32 assetId, uint256 ceiling) external onlyBy("gov") {
        emit LogVarUpdate("Vault", assetId, "ceiling", assets[assetId].ceiling, ceiling);
        assets[assetId].ceiling = ceiling;
    }

    /**
     * @notice Updates a asset's debt floor
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
        emit LogVarUpdate("Vault", assetId, "debtAccumulator", assets[assetId].debtAccumulator, debtRateIncrease);
        emit LogVarUpdate("Vault", assetId, "equityAccumulator", assets[assetId].equityAccumulator, equityRateIncrease);

        Asset storage asset = assets[assetId];
        uint256 newDebt = asset.normDebt * debtRateIncrease;
        uint256 newEquity = asset.normEquity * equityRateIncrease;

        asset.debtAccumulator += debtRateIncrease;
        asset.equityAccumulator += equityRateIncrease;

        uint256 protocolFeeToCollect = asset.normEquity * protocolFeeRates;
        require(
            newEquity + protocolFeeToCollect <= newDebt,
            "VaultEngine/updateAccumulators: The equity rate increase is larger than the debt rate increase"
        );
        stablecoin[reservePool] += protocolFeeToCollect;
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

    function _modifySupply(
        bytes32 assetId,
        address treasuryAddress,
        address account,
        int256 amount
    ) internal onlyBy("gov") {
        require(registry.checkRole("treasury", treasuryAddress), "Vault/modifySupply: Treasury address is not valid");

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        Vault storage vault = vaults[assetId][account];
        vault.underlying = Math.add(vault.underlying, amount);

        stablecoin[account] = Math.add(stablecoin[account], amount);

        emit SupplyModified(msg.sender, account, amount);
    }

    function _modifyEquity(
        bytes32 assetId,
        address treasuryAddress,
        int256 underlyingAmount,
        int256 equityAmount
    ) internal {
        require(registry.checkRole("treasury", treasuryAddress), "Vault/modifyEquity: Treasury address is not valid");

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        Vault storage vault = vaults[assetId][msg.sender];
        vault.standby = Math.sub(vault.standby, underlyingAmount);
        vault.underlying = Math.add(vault.underlying, underlyingAmount);
        int256 equityCreated = Math.mul(assets[assetId].equityAccumulator, equityAmount);
        vault.equity = Math.add(vault.equity, equityAmount);
        vault.initialEquity = Math.add(vault.initialEquity, equityCreated);

        assets[assetId].normEquity = Math.add(assets[assetId].normEquity, equityAmount);

        totalEquity = Math.add(totalEquity, equityCreated);

        require(totalEquity <= assets[assetId].ceiling, "Vault/modifyEquity: Supply ceiling reached");
        require(
            vault.equity == 0 || (vault.equity * RAY) > assets[assetId].floor,
            "Vault/modifyEquity: Equity smaller than floor"
        );
        certifyEquityPosition(assetId, vault);

        stablecoin[treasuryAddress] = Math.add(stablecoin[treasuryAddress], equityCreated);

        emit EquityModified(msg.sender, underlyingAmount, equityCreated);
    }

    function _modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) internal {
        require(registry.checkRole("treasury", treasuryAddress), "Vault/modifyDebt: Treasury address is not valid");

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        if (debtAmount > 0) {
            require(
                stablecoin[treasuryAddress] >= uint256(debtAmount),
                "Vault/modifyDebt: Treasury doesn't have enough equity to loan this amount"
            );
        }

        Vault memory vault = vaults[assetId][msg.sender];
        vault.standby = Math.sub(vault.standby, collAmount);
        vault.collateral = Math.add(vault.collateral, collAmount);
        int256 debtCreated = Math.mul(assets[assetId].debtAccumulator, debtAmount);
        vault.debt = Math.add(vault.debt, debtAmount);

        assets[assetId].normDebt = Math.add(assets[assetId].normDebt, debtAmount);

        totalDebt = Math.add(totalDebt, debtCreated);
        totalStablecoin = Math.add(totalStablecoin, debtCreated);

        require(totalDebt <= assets[assetId].ceiling, "Vault/modifyDebt: Debt ceiling reached");
        require(
            vault.debt == 0 || (vault.debt * RAY) > assets[assetId].floor,
            "Vault/modifyDebt: Debt smaller than floor"
        );
        certifyDebtPosition(assetId, vault);

        stablecoin[msg.sender] = Math.add(stablecoin[msg.sender], debtCreated);
        stablecoin[treasuryAddress] = Math.sub(stablecoin[treasuryAddress], debtCreated);

        vaults[assetId][msg.sender] = vault;

        emit DebtModified(msg.sender, collAmount, debtCreated);
    }

    /**
     * @dev Certifies that the vault meets the asset requirement
     * @param assetId The asset type ID
     * @param vault The vault to certify
     */
    function certifyEquityPosition(bytes32 assetId, Vault memory vault) internal view {
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
    function certifyDebtPosition(bytes32 assetId, Vault memory vault) internal view {
        require(
            (vault.debt * assets[assetId].debtAccumulator) <= vault.collateral * assets[assetId].adjustedPrice,
            "Vault/certify: Not enough collateral"
        );
    }
}
