// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/DSMath.sol";

interface VaultEngineLike {
  function collateralTypes(bytes32)
    external
    returns (uint256 debtAccumulator, uint256 suppAccumulator);

  function totalDebt() external returns (uint256);

  function totalCapital() external returns (uint256);

  function updateAccumulators(
    bytes32 collId,
    uint256 debtAccumulator,
    uint256 suppAccumulator
  ) external;
}

interface IAPR {
  function APR_TO_MPR(uint256 APR) external returns (uint256);
}

/**
 * @notice Creates loans and manages vault debt.
 */
contract Teller is Stateful, DSMath {
  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////

  struct Collateral {
    uint256 lastUpdated;
    uint256 lastUtilization;
  }

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////

  mapping(bytes32 => Collateral) public collateralTypes;

  uint256 public APR; // Annualized percentage rate
  uint256 public MPR; // Momentized percentage rate
  VaultEngineLike public vaultEngine;
  IAPR public lowAprRate;
  IAPR public highAprRate;

  // One as 1e18, or as 100%
  uint256 constant ONE = 10**18;

  // Set max APR to 100%
  uint256 constant MAX_APR = ONE * 2 * 1e9;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(
    address registryAddress,
    VaultEngineLike vaultEngineAddress,
    IAPR lowAprAddress,
    IAPR highAprAddress
  ) Stateful(registryAddress) {
    vaultEngine = vaultEngineAddress;
    lowAprRate = lowAprAddress;
    highAprRate = highAprAddress;
    APR = RAY;
    MPR = RAY;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function initCollType(bytes32 collId) external onlyBy("gov") {
    collateralTypes[collId].lastUpdated = block.timestamp;
  }

  /**
   * @dev Updates the debt and capital indices
   */
  function updateAccumulator(bytes32 collId) external {
    require(
      collateralTypes[collId].lastUpdated != 0,
      "TELLER: Collateral Type not initialized"
    );

    Collateral memory coll = collateralTypes[collId];
    (uint256 debtAccumulator, uint256 suppAccumulator) =
      vaultEngine.collateralTypes(collId);
    uint256 totalDebt = vaultEngine.totalDebt();
    uint256 totalSupply = vaultEngine.totalCapital();

    require(
      totalSupply > 0,
      "Teller/UpdateAccumulator: total Capital can not be zero"
    );

    // Update debt accumulator
    debtAccumulator = rmul(
      rpow(MPR, (block.timestamp - coll.lastUpdated)),
      debtAccumulator
    );

    // Update capital accumulator
    uint256 multipliedByUtilization =
      rmul(sub(MPR, RAY), coll.lastUtilization * 1e9);
    uint256 multipliedByUtilizationPlusOne = add(multipliedByUtilization, RAY);
    uint256 exponentiated =
      rpow(
        multipliedByUtilizationPlusOne,
        (block.timestamp - coll.lastUpdated)
      );
    suppAccumulator = rmul(exponentiated, suppAccumulator);

    // Set new APR (round to nearest 0.25%)
    coll.lastUtilization = wdiv(totalDebt, totalSupply);
    if (coll.lastUtilization >= 1e18) {
      APR = MAX_APR;
    } else {
      uint256 oneMinusUtilization = sub(RAY, coll.lastUtilization * 1e9);
      uint256 oneDividedByOneMinusUtilization =
        rdiv(10**27 * 0.01, oneMinusUtilization);

      uint256 round = 0.0025 * 10**27;
      APR = add(oneDividedByOneMinusUtilization, RAY);
      APR = ((APR + round - 1) / round) * round;

      if (APR > MAX_APR) {
        APR = MAX_APR;
      }
    }
    // Set new MPR
    if (APR > 1500000000000000000000000000) {
      MPR = highAprRate.APR_TO_MPR(APR);
    } else {
      MPR = lowAprRate.APR_TO_MPR(APR);
    }

    // Update time index
    coll.lastUpdated = block.timestamp;
    vaultEngine.updateAccumulators(collId, debtAccumulator, suppAccumulator);
    collateralTypes[collId] = coll;
  }
}
