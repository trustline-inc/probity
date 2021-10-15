pragma solidity ^0.8.0;

contract MockVaultEngine {
  struct Collateral {
    uint256 debtAccumulator;
    uint256 suppAccumulator;
  }

  mapping(bytes32 => Collateral) public collateralTypes;
  mapping(address => uint256) public AUR;
  mapping(address => uint256) public TCN;

  uint256 public totalDebt;
  uint256 public totalCapital;

  function addAurei(address user, uint256 amount) external {
    AUR[user] += amount;
  }

  function removeAurei(address user, uint256 amount) external {
    AUR[user] -= amount;
  }

  function reduceYield(address user, uint256 amount) external {
    TCN[user] -= amount;
  }

  // added for testing purposes
  function addTcn(address user, uint256 amount) external {
    TCN[user] += amount;
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
    collateralTypes[collId].suppAccumulator = 1e27;
  }

  function updateAccumulators(
    bytes32 collId,
    uint256 debtAccumulator,
    uint256 suppAccumulator
  ) external {
    collateralTypes[collId].debtAccumulator = debtAccumulator;
    collateralTypes[collId].suppAccumulator = suppAccumulator;
  }
}
