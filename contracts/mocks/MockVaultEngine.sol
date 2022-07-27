// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

contract MockVaultEngine {
    struct Vault {
        uint256 standby; // Assets that are on standby
        uint256 underlying; // Amount covering an equity position
        uint256 collateral; // Amount covering a debt position
        uint256 debt; // Vault debt balance
        uint256 equity; // Vault equity balance
        uint256 initialEquity; // Tracks the amount of equity (less interest)
    }

    struct Asset {
        uint256 adjustedPrice; // The asset price, adjusted for the asset ratio
        uint256 normDebt; // Normalized debt amount
        uint256 normEquity; // Normalized equity amount
        uint256 ceiling; // Max. amount of asset that can be active in a position
        uint256 floor; // Min. amount of asset that must be active to open a position
        Category category; // Type of asset (underlying or collateral)
    }

    struct LiquidateDebtPositionCall {
        bytes32 assetId;
        address user;
        address auctioneer;
        address reservePool;
        int256 collateralAmount;
        int256 debtAmount;
    }

    struct LiquidateEquityPositionCall {
        bytes32 assetId;
        address user;
        address auctioneer;
        int256 assetToAuction;
        int256 assetToReturn;
        int256 equity;
        int256 initialEquity;
    }

    enum Category {
        UNDERLYING,
        COLLATERAL,
        BOTH
    }

    mapping(bytes32 => mapping(address => Vault)) public vaults;
    mapping(bytes32 => bool) public states;
    mapping(bytes32 => Asset) public assets;
    mapping(address => uint256) public systemCurrency;
    mapping(address => uint256) public pbt;
    mapping(address => uint256) public systemDebt;

    uint256 public protocolFeeRates;
    uint256 public lendingPoolDebt;
    uint256 public lendingPoolEquity;
    uint256 public lendingPoolSupply;
    uint256 public debtAccumulator = 1e27;
    uint256 public equityAccumulator = 1e27;
    LiquidateDebtPositionCall public lastLiquidateDebtPositionCall;
    LiquidateEquityPositionCall public lastLiquidateEquityPositionCall;

    function addStablecoin(address user, uint256 amount) external {
        systemCurrency[user] += amount;
    }

    function removeStablecoin(address user, uint256 amount) external {
        systemCurrency[user] -= amount;
    }

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external {
        systemCurrency[from] -= amount;
        systemCurrency[to] += amount;
    }

    function setStablecoin(address user, uint256 amount) external {
        systemCurrency[user] = amount;
    }

    function setsystemDebt(address user, uint256 amount) external {
        systemDebt[user] = amount;
    }

    function reducePbt(address user, uint256 amount) external {
        pbt[user] -= amount;
    }

    // added for testing purposes
    function addPbt(address user, uint256 amount) external {
        pbt[user] += amount;
    }

    function setTotalUserDebt(uint256 newTotalUserDebt) external {
        lendingPoolDebt = newTotalUserDebt;
    }

    function setTotalEquity(uint256 newTotalEquity) external {
        lendingPoolEquity = newTotalEquity;
    }

    function setTotalSupply(uint256 newlendingPoolSupply) external {
        lendingPoolSupply = newlendingPoolSupply;
    }

    function initAsset(bytes32 assetId, Category category) external {
        assets[assetId].category = category;
    }

    function updateAdjustedPrice(bytes32 assetId, uint256 price) external {
        assets[assetId].adjustedPrice = price;
    }

    function updateAsset(
        bytes32 assetId,
        uint256 adjustedPrice,
        uint256 normDebt,
        uint256 normEquity,
        uint256 ceiling,
        uint256 floor
    ) external {
        Asset storage asset = assets[assetId];

        asset.adjustedPrice = adjustedPrice;
        asset.normDebt = normDebt;
        asset.normEquity = normEquity;
        asset.ceiling = ceiling;
        asset.floor = floor;
    }

    function updateAccumulators(
        bytes32 assetId,
        address reservePool,
        uint256 debtAccumulatorIncrease,
        uint256 equityAccumulatorIncrease,
        uint256 protocolFeeRates_
    ) external {
        debtAccumulator += debtAccumulatorIncrease;
        equityAccumulator += equityAccumulatorIncrease;
        protocolFeeRates = protocolFeeRates_;
    }

    function updateNormValues(
        bytes32 assetId,
        uint256 normDebt,
        uint256 normEquity
    ) external {
        assets[assetId].normDebt = normDebt;
        assets[assetId].normEquity = normEquity;
    }

    function updateVault(
        bytes32 assetId,
        address user,
        uint256 standbyAmount,
        uint256 underlyingAmount,
        uint256 collateralAmount,
        uint256 debt,
        uint256 equity,
        uint256 initialEquity
    ) external {
        Vault storage vault = vaults[assetId][user];
        vault.standby = standbyAmount;
        vault.underlying = underlyingAmount;
        vault.collateral = collateralAmount;
        vault.debt = debt;
        vault.equity = equity;
        vault.initialEquity = initialEquity;
    }

    function setShutdownState() external {
        states[bytes32("shutdown")] = true;
    }

    function settle(uint256 amount) external {
        systemCurrency[msg.sender] -= amount;
        systemDebt[msg.sender] -= amount;
    }

    function increaseSystemDebt(uint256 amount) external {
        systemCurrency[msg.sender] += amount;
        systemDebt[msg.sender] += amount;
        lendingPoolDebt += amount;
    }

    function liquidateDebtPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount
    ) external {
        lastLiquidateDebtPositionCall = LiquidateDebtPositionCall(
            assetId,
            user,
            auctioneer,
            reservePool,
            collateralAmount,
            debtAmount
        );
    }

    function liquidateEquityPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        int256 assetToAuction,
        int256 assetToReturn,
        int256 equityAmount,
        int256 initialEquityAmount
    ) external {
        lastLiquidateEquityPositionCall = LiquidateEquityPositionCall(
            assetId,
            user,
            auctioneer,
            assetToAuction,
            assetToReturn,
            equityAmount,
            initialEquityAmount
        );
    }

    function moveAsset(
        bytes32 collateral,
        address from,
        address to,
        uint256 amount
    ) external {
        vaults[collateral][from].standby -= amount;
        vaults[collateral][to].standby += amount;
    }
}
