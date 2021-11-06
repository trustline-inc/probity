pragma solidity ^0.8.0;

contract MockVaultEngine {
    struct Collateral {
        uint256 debtAccumulator;
        uint256 capitalAccumulator;
    }

    mapping(bytes32 => Collateral) public collateralTypes;
    mapping(address => uint256) public aur;
    mapping(address => uint256) public tcn;

    uint256 public protocolFeeRates;
    uint256 public totalDebt;
    uint256 public totalCapital;

    function addAurei(address user, uint256 amount) external {
        aur[user] += amount;
    }

    function removeAurei(address user, uint256 amount) external {
        aur[user] -= amount;
    }

    function removeTcn(address user, uint256 amount) external {
        tcn[user] -= amount;
    }

    // added for testing purposes
    function addTcn(address user, uint256 amount) external {
        tcn[user] += amount;
    }

    //added for testing purposes
    function setTotalDebt(uint256 newTotalDebt) external {
        totalDebt = newTotalDebt;
    }

    // added for testing purposes
    function setTotalCapital(uint256 newTotalCapital) external {
        totalCapital = newTotalCapital;
    }

    function initCollType(bytes32 collId) external {
        collateralTypes[collId].debtAccumulator = 1e27;
        collateralTypes[collId].capitalAccumulator = 1e27;
    }

    function updateAccumulators(
        bytes32 collId,
        address reservePool,
        uint256 debtRateIncrease,
        uint256 capitalRateIncrease,
        uint256 protocolFeeRates_
    ) external {
        Collateral storage coll = collateralTypes[collId];
        coll.debtAccumulator += debtRateIncrease;
        coll.capitalAccumulator += capitalRateIncrease;
        protocolFeeRates = protocolFeeRates_;
    }
}
