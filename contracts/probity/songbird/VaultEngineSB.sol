// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../dependencies/Stateful.sol";
import "../../dependencies/Eventful.sol";

/**
 * @title VaultEngine contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 */

contract VaultEngineSB is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Vault {
        uint256 standbyAssetAmount; // assets that are on standby
        uint256 activeAssetAmount; // assets that are actively covering a position
        uint256 debt; // Vault's debt balance
        uint256 equity; // Vault's equity balance
        uint256 lastEquityAccumulator; // Most recent value of the equity rate accumulator
    }

    struct Asset {
        uint256 debtAccumulator; // Cumulative debt rate
        uint256 equityAccumulator; // Cumulative equity rate
        uint256 adjustedPrice; // The asset price, adjusted for the asset ratio
        uint256 normDebt; // Normalized debt amount
        uint256 normEquity; // Normalized equity amount
        uint256 ceiling; // Max. amount of asset that can be active in a position
        uint256 floor; // Min. amount of asset that must be active to open a position
    }

    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    uint256 public totalDebt;
    uint256 public totalEquity;
    uint256 public totalUnbackedDebt;
    address[] public userList;
    mapping(address => bool) public userExists;
    mapping(address => uint256) public stablecoin;
    mapping(address => uint256) public pbt;
    mapping(address => uint256) public unbackedDebt;
    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => mapping(address => Vault)) public vaults;

    // For SongBird Purposes only
    uint256 public individualVaultLimit;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event EquityModified(address indexed user, int256 underlyingAmount, int256 equityAmount);
    event DebtModified(address indexed user, int256 collAmount, int256 debtAmount);

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
    function getUserList() external view returns (address[] memory list) {
        return userList;
    }

    /**
     * @dev returns the calculated balances of the user's positions
     * @param assetId the asset ID
     * @param user the vault owner's address
     */
    function balanceOf(bytes32 assetId, address user)
        external
        view
        returns (
            uint256 activeAssetAmount,
            uint256 debt,
            uint256 equity
        )
    {
        Vault storage vault = vaults[assetId][user];
        Asset storage asset = assets[assetId];
        return (
            vault.activeAssetAmount * asset.adjustedPrice,
            vault.debt * asset.debtAccumulator,
            vault.equity * asset.equityAccumulator
        );
    }

    /**
     * @dev Modifies a vault's asset balance.
     * @param asset The asset ID
     * @param user The address of the vault owner
     * @param amount The amount of asset to modify
     */
    function modifyStandbyAsset(
        bytes32 asset,
        address user,
        int256 amount
    ) external onlyByProbity {
        vaults[asset][user].standbyAssetAmount = add(vaults[asset][user].standbyAssetAmount, amount);
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
        vaults[asset][from].standbyAssetAmount -= amount;
        vaults[asset][to].standbyAssetAmount += amount;
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
     * @dev Add stablecoin to user vault.
     * @param user The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to add
     */
    function addStablecoin(address user, uint256 amount) external onlyBy("treasury") {
        stablecoin[user] += amount;
    }

    /**
     * @dev Remove stablecoin from user vault.
     * @param user The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to remove
     */
    function removeStablecoin(address user, uint256 amount) external onlyBy("treasury") {
        stablecoin[user] -= amount;
    }

    /**
     * @dev Reduce a user's PBT balance.
     * @param user The address of the vault to reduce PBT from.
     * @param amount The amount of PBT to reduce.
     */
    function reducePBT(address user, uint256 amount) external onlyBy("treasury") {
        pbt[user] -= amount;
    }

    /**
     * @dev Accrues vault interest and PBT
     * @param assetId The ID of the vault asset
     */
    function collectInterest(bytes32 assetId) public {
        Vault memory vault = vaults[assetId][msg.sender];
        Asset memory asset = assets[assetId];
        pbt[msg.sender] += vault.equity * (asset.equityAccumulator - vault.lastEquityAccumulator);
        stablecoin[msg.sender] += vault.equity * (asset.equityAccumulator - vault.lastEquityAccumulator);
        vaults[assetId][msg.sender].lastEquityAccumulator = asset.equityAccumulator;
    }

    /**
     * @notice Adds equity to the caller's vault
     * @param assetId The ID of the asset being modified
     * @param treasuryAddress A registered treasury contract address
     * @param underlyingAmount The amount of asset to add
     * @param equityAmount The amount of equity to add
     */
    function modifyEquity(
        bytes32 assetId,
        address treasuryAddress,
        int256 underlyingAmount,
        int256 equityAmount
    ) external onlyByWhiteListed {
        require(
            registry.checkValidity("treasury", treasuryAddress),
            "Vault/modifyEquity: Treasury address is not valid"
        );

        if (!userExists[msg.sender]) {
            userList.push(msg.sender);
            userExists[msg.sender] = true;
        }

        collectInterest(assetId);
        Vault storage vault = vaults[assetId][msg.sender];
        vault.standbyAssetAmount = sub(vault.standbyAssetAmount, underlyingAmount);
        vault.activeAssetAmount = add(vault.activeAssetAmount, underlyingAmount);
        int256 normalizedEquity = div(equityAmount, assets[assetId].equityAccumulator);
        vault.equity = add(vault.equity, normalizedEquity);

        assets[assetId].normEquity = add(assets[assetId].normEquity, normalizedEquity);

        totalEquity = add(totalEquity, equityAmount);

        require(totalEquity <= assets[assetId].ceiling, "Vault/modifyEquity: Equity ceiling reached");
        require(
            vault.equity == 0 || (vault.equity * RAY) > assets[assetId].floor,
            "Vault/modifyEquity: Equity floor reached"
        );

        certify(assetId, vault);
        checkVaultUnderLimit(assetId, vault);

        stablecoin[treasuryAddress] = add(stablecoin[treasuryAddress], equityAmount);

        emit EquityModified(msg.sender, underlyingAmount, equityAmount);
    }

    /**
     * @notice Modifies vault debt
     * @param assetId The ID of the vault asset
     * @param treasuryAddress The address of the desired treasury contract
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of stablecoin to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) external onlyByWhiteListed {
        require(registry.checkValidity("treasury", treasuryAddress), "Vault/modifyDebt: Treasury address is not valid");

        if (!userExists[msg.sender]) {
            userList.push(msg.sender);
            userExists[msg.sender] = true;
        }

        if (debtAmount > 0) {
            require(
                stablecoin[treasuryAddress] >= uint256(debtAmount),
                "Vault/modifyDebt: Treasury doesn't have enough equity to loan this amount"
            );
        }

        Vault memory vault = vaults[assetId][msg.sender];
        vault.standbyAssetAmount = sub(vault.standbyAssetAmount, collAmount);
        vault.activeAssetAmount = add(vault.activeAssetAmount, collAmount);
        int256 normalizedDebt = div(debtAmount, assets[assetId].debtAccumulator);
        vault.debt = add(vault.debt, normalizedDebt);

        assets[assetId].normDebt = add(assets[assetId].normDebt, normalizedDebt);

        totalDebt = add(totalDebt, debtAmount);

        require(totalDebt <= assets[assetId].ceiling, "Vault/modifyDebt: Debt ceiling reached");
        require(
            vault.debt == 0 || (vault.debt * RAY) > assets[assetId].floor,
            "Vault/modifyDebt: Debt smaller than floor"
        );
        certify(assetId, vault);
        checkVaultUnderLimit(assetId, vault);

        stablecoin[msg.sender] = add(stablecoin[msg.sender], debtAmount);
        stablecoin[treasuryAddress] = sub(stablecoin[treasuryAddress], debtAmount);

        vaults[assetId][msg.sender] = vault;

        emit DebtModified(msg.sender, collAmount, debtAmount);
    }

    /**
     * @notice Liquidates an underassetized vault
     * @param assetId The ID of the vault asset
     * @param user The address of the vault to liquidate
     * @param auctioneer The address of the desired auctioneer contract
     * @param reservePool The address of the desired reserve pool contract
     * @param assetAmount The amount of asset to liquidate
     * @param debtAmount The amount of debt to clear
     * @param equityAmount The amount of equity to clear
     */
    function liquidateVault(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 assetAmount,
        int256 debtAmount,
        int256 equityAmount
    ) external onlyByProbity {
        Vault storage vault = vaults[assetId][user];
        Asset storage coll = assets[assetId];

        vault.activeAssetAmount = add(vault.activeAssetAmount, assetAmount);
        vault.debt = add(vault.debt, debtAmount);
        vault.equity = add(vault.equity, equityAmount);
        coll.normDebt = add(coll.normDebt, debtAmount);
        coll.normEquity = add(coll.normEquity, equityAmount);
        int256 aurToRaise = mul(coll.debtAccumulator, debtAmount) + mul(RAY, equityAmount);

        vaults[assetId][auctioneer].standbyAssetAmount = sub(
            vaults[assetId][auctioneer].standbyAssetAmount,
            assetAmount
        );
        unbackedDebt[reservePool] = sub(unbackedDebt[reservePool], aurToRaise);
        totalUnbackedDebt = sub(totalUnbackedDebt, aurToRaise);

        emit Log("vault", "liquidateVault", msg.sender);
    }

    /**
     * @notice Used for settlement by the reserve pool
     * @param amount The amount to settle
     */
    function settle(uint256 amount) external onlyByProbity {
        stablecoin[msg.sender] -= amount;
        unbackedDebt[msg.sender] -= amount;
        totalDebt -= amount;
        emit Log("vault", "settle", msg.sender);
    }

    function increaseSystemDebt(uint256 amount) external onlyByProbity {
        stablecoin[msg.sender] += amount;
        unbackedDebt[msg.sender] += amount;
        totalDebt += amount;
        emit Log("vault", "increaseSystemDebt", msg.sender);
    }

    /// Admin-related functions

    /**
     * @dev Initializes a new asset
     * @param assetId The asset ID
     */
    function initAssetType(bytes32 assetId) external onlyBy("gov") {
        assets[assetId].debtAccumulator = RAY;
        assets[assetId].equityAccumulator = RAY;
    }

    /**
     * @dev Updates a asset's debt ceiling
     * @param assetId The asset ID
     * @param ceiling The new ceiling amount
     */
    function updateCeiling(bytes32 assetId, uint256 ceiling) external onlyBy("gov") {
        emit LogVarUpdate("Vault", assetId, "ceiling", assets[assetId].ceiling, ceiling);
        assets[assetId].ceiling = ceiling;
    }

    /**
     * @notice Updates a asset's debt floor
     * @dev Prevent users from creating multiple vaults with very low debt amount and asset
     * @param assetId The asset ID
     * @param floor The new floor amount
     */
    function updateFloor(bytes32 assetId, uint256 floor) external onlyBy("gov") {
        emit LogVarUpdate("Vault", assetId, "floor", assets[assetId].floor, floor);
        assets[assetId].floor = floor;
    }

    /**
     * @notice Updates individual vault limit
     * For Songbird purposes only
     */
    function updateIndividualVaultLimit(uint256 newLimit) external onlyBy("gov") {
        individualVaultLimit = newLimit;
    }

    /**
     * @notice Check if user's vault is under individual vault limit
     * For Songbird purposes only
     */
    function checkVaultUnderLimit(bytes32 assetId, Vault memory vault) internal view {
        require(
            (vault.debt * assets[assetId].debtAccumulator) + (vault.equity * RAY) <= individualVaultLimit,
            "Vault is over the individual vault limit"
        );
    }

    /**
     * @dev Updates cumulative indices for the specified asset
     * @param assetId The asset ID
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

        totalEquity += newEquity;
        totalDebt += newDebt;

        asset.debtAccumulator += debtRateIncrease;
        asset.equityAccumulator += equityRateIncrease;

        uint256 protocolFeeToCollect = asset.normEquity * protocolFeeRates;

        require(
            newEquity + protocolFeeToCollect <= newDebt,
            "VaultEngine/updateAccumulators: New equity created is larger than new debt"
        );
        stablecoin[reservePool] += protocolFeeToCollect;
    }

    /**
     * @dev Updates the price of a asset
     * @param assetId The asset ID
     * @param price The new price
     */
    function updateAdjustedPrice(bytes32 assetId, uint256 price) external onlyByProbity {
        emit LogVarUpdate("Vault", assetId, "price", assets[assetId].adjustedPrice, price);
        assets[assetId].adjustedPrice = price;
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    /**
     * @dev Certifies that the vault meets the asset requirement
     * @param assetId The asset ID
     * @param vault The vault to certify
     */
    function certify(bytes32 assetId, Vault memory vault) internal view {
        require(
            (vault.debt * assets[assetId].debtAccumulator) + (vault.equity * RAY) <=
                vault.activeAssetAmount * assets[assetId].adjustedPrice,
            "Vault/certify: Not enough asset"
        );
    }

    function sub(uint256 a, int256 b) internal pure returns (uint256 c) {
        unchecked {
            c = a - uint256(b);
        }
        require(b <= 0 || c <= a, "Vault/sub: sub op failed");
        require(b >= 0 || c >= a, "Vault/sub: sub op failed");
    }

    function add(uint256 a, int256 b) internal pure returns (uint256 c) {
        unchecked {
            c = a + uint256(b);
        }
        require(b >= 0 || c <= a, "Vault/add: add op failed");
        require(b <= 0 || c >= a, "Vault/add: add op failed");
    }

    function div(int256 a, uint256 b) internal pure returns (int256 c) {
        c = a / int256(b);
    }

    function mul(uint256 a, int256 b) internal pure returns (int256 c) {
        c = int256(a) * b;
        require(int256(a) >= 0, "Vault/mul: mul op failed");
        require(b == 0 || c / b == int256(a), "Vault/mul: mul op failed");
    }
}
