pragma solidity ^0.8.0;

contract MockVaultEngine {
    struct Vault {
        uint256 freeCollateral; // Collateral that is currently free
        uint256 usedCollateral; // Collateral that is being utilized
        uint256 debt; // Vault's debt balance
        uint256 equity; // Vault's equity balance
        uint256 lastEquityAccumulator; // Most recent value of the equity rate accumulator
    }

    struct Collateral {
        uint256 debtAccumulator; // Cumulative debt rate
        uint256 equityAccumulator; // Cumulative equity rate
        uint256 price; // Price adjusted for collateral ratio
        uint256 normDebt; // Normalized debt
        uint256 normEquity; // Normalized supply
        uint256 ceiling; // Max. amount that can be supplied/borrowed
        uint256 floor; // Min. amount of that must be supplied/borrowed
    }

    struct LiquidateVaultCall {
        bytes32 collId;
        address user;
        address auctioneer;
        address reservePool;
        int256 collateralAmount;
        int256 debtAmount;
        int256 equityAmount;
    }

    mapping(bytes32 => mapping(address => Vault)) public vaults;
    mapping(bytes32 => bool) public states;
    mapping(bytes32 => Collateral) public collateralTypes;
    mapping(address => uint256) public stablecoin;
    mapping(address => uint256) public pbt;
    mapping(address => uint256) public unbackedStablecoin;

    uint256 public protocolFeeRates;
    uint256 public totalDebt;
    uint256 public totalEquity;
    LiquidateVaultCall public lastLiquidateVaultCall;

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

    function setUnbackedStablecoin(address user, uint256 amount) external {
        unbackedStablecoin[user] = amount;
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

    function initCollType(bytes32 collId) external {
        collateralTypes[collId].debtAccumulator = 1e27;
        collateralTypes[collId].equityAccumulator = 1e27;
    }

    function updateCollateralType(
        bytes32 collId,
        uint256 price,
        uint256 normDebt,
        uint256 normEquity,
        uint256 ceiling,
        uint256 floor
    ) external {
        Collateral storage coll = collateralTypes[collId];

        coll.price = price;
        coll.normDebt = normDebt;
        coll.normEquity = normEquity;
        coll.ceiling = ceiling;
        coll.floor = floor;
    }

    function updateAccumulators(
        bytes32 collId,
        address reservePool,
        uint256 debtAccumulator,
        uint256 equityAccumulator,
        uint256 protocolFeeRates_
    ) external {
        Collateral storage coll = collateralTypes[collId];
        coll.debtAccumulator += debtAccumulator;
        coll.equityAccumulator += equityAccumulator;
        protocolFeeRates = protocolFeeRates_;
    }

    function updateNormValues(
        bytes32 collId,
        uint256 normDebt,
        uint256 normEquity
    ) external {
        collateralTypes[collId].normDebt = normDebt;
        collateralTypes[collId].normEquity = normEquity;
    }

    function updateVault(
        bytes32 collId,
        address user,
        uint256 freeColl,
        uint256 usedColl,
        uint256 debt,
        uint256 equity,
        uint256 lastEquityAccumulator
    ) external {
        Vault storage vault = vaults[collId][user];
        vault.freeCollateral = freeColl;
        vault.usedCollateral = usedColl;
        vault.debt = debt;
        vault.equity = equity;
        vault.lastEquityAccumulator = lastEquityAccumulator;
    }

    function setShutdownState() external {
        states[bytes32("shutdown")] = true;
    }

    function liquidateVault(
        bytes32 collId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount,
        int256 equityAmount
    ) external {
        lastLiquidateVaultCall = LiquidateVaultCall(
            collId,
            user,
            auctioneer,
            reservePool,
            collateralAmount,
            debtAmount,
            equityAmount
        );
    }

    function moveCollateral(
        bytes32 collateral,
        address from,
        address to,
        uint256 amount
    ) external {
        vaults[collateral][from].freeCollateral -= amount;
        vaults[collateral][to].freeCollateral += amount;
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
