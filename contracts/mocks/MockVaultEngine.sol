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
        uint256 debtAccumulator; // Cumulative debt rate
        uint256 equityAccumulator; // Cumulative equity rate
        uint256 adjustedPrice; // The asset price, adjusted for the asset ratio
        uint256 normDebt; // Normalized debt amount
        uint256 normEquity; // Normalized equity amount
        uint256 ceiling; // Max. amount of asset that can be active in a position
        uint256 floor; // Min. amount of asset that must be active to open a position
    }

    struct LiquidateDebtPositionCall {
        bytes32 collId;
        address user;
        address auctioneer;
        address reservePool;
        int256 collateralAmount;
        int256 debtAmount;
    }

    mapping(bytes32 => mapping(address => Vault)) public vaults;
    mapping(bytes32 => bool) public states;
    mapping(bytes32 => Asset) public assets;
    mapping(address => uint256) public stablecoin;
    mapping(address => uint256) public pbt;
    mapping(address => uint256) public unbackedDebt;

    uint256 public protocolFeeRates;
    uint256 public totalDebt;
    uint256 public totalEquity;
    LiquidateDebtPositionCall public lastLiquidateDebtPositionCall;

    function addStablecoin(address user, uint256 amount) external {
        stablecoin[user] += amount;
    }

    function removeStablecoin(address user, uint256 amount) external {
        stablecoin[user] -= amount;
    }

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external {
        stablecoin[from] -= amount;
        stablecoin[to] += amount;
    }

    function setStablecoin(address user, uint256 amount) external {
        stablecoin[user] = amount;
    }

    function setUnbackedDebt(address user, uint256 amount) external {
        unbackedDebt[user] = amount;
    }

    function reducePbt(address user, uint256 amount) external {
        pbt[user] -= amount;
    }

    // added for testing purposes
    function addPbt(address user, uint256 amount) external {
        pbt[user] += amount;
    }

    //added for testing purposes
    function setTotalDebt(uint256 newTotalDebt) external {
        totalDebt = newTotalDebt;
    }

    // added for testing purposes
    function setTotalEquity(uint256 newTotalEquity) external {
        totalEquity = newTotalEquity;
    }

    function initAssetType(bytes32 assetId) external {
        assets[assetId].debtAccumulator = 1e27;
        assets[assetId].equityAccumulator = 1e27;
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
        uint256 debtAccumulator,
        uint256 equityAccumulator,
        uint256 protocolFeeRates_
    ) external {
        Asset storage asset = assets[assetId];
        asset.debtAccumulator += debtAccumulator;
        asset.equityAccumulator += equityAccumulator;
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
        uint256 equity
    ) external {
        Vault storage vault = vaults[assetId][user];
        vault.standby = standbyAmount;
        vault.underlying = underlyingAmount;
        vault.collateral = collateralAmount;
        vault.debt = debt;
        vault.equity = equity;
    }

    function setShutdownState() external {
        states[bytes32("shutdown")] = true;
    }

    function liquidateDebtPosition(
        bytes32 collId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount
    ) external {
        lastLiquidateDebtPositionCall = LiquidateDebtPositionCall(
            collId,
            user,
            auctioneer,
            reservePool,
            collateralAmount,
            debtAmount
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

    function mul(uint256 a, int256 b) internal pure returns (int256 c) {
        c = int256(a) * b;
        require(int256(a) >= 0, "Vault/mul: mul op failed");
        require(b == 0 || c / b == int256(a), "Vault/mul: mul op failed");
    }
}
