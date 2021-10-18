// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";

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
contract Teller is Stateful {
  event RatesUpdated(
    uint256 timestamp,
    uint256 debtAccumulator,
    uint256 suppAccumulator
  );

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

  //  uint256 constant WAD = 10**18;
  //  uint256 constant RAY = 10**27;

  uint256 constant WAD = 10**18;
  uint256 constant RAY = 10**27;

  // Set max APR to 100%
  uint256 constant MAX_APR = WAD * 2 * 1e9;

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
   * @dev Updates the debt and capital rate accumulators
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
      rmul(MPR - RAY, coll.lastUtilization * 1e9);
    uint256 multipliedByUtilizationPlusOne = multipliedByUtilization + RAY;
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
      uint256 oneMinusUtilization = RAY - (coll.lastUtilization * 1e9);
      uint256 oneDividedByOneMinusUtilization =
        rdiv(10**27 * 0.01, oneMinusUtilization);

      uint256 round = 0.0025 * 10**27;
      APR = oneDividedByOneMinusUtilization + RAY;
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

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
    z = ((x * y) + (RAY / 2)) / RAY;
  }

  function wdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
    z = ((x * WAD) + (y / 2)) / y;
  }

  function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
    z = ((x * RAY) + (y / 2)) / y;
  }

  // This famous algorithm is called "exponentiation by squaring"
  // and calculates x^n with x as fixed-point and n as regular unsigned.
  //
  // It's O(log n), instead of O(n) for naive repeated multiplication.
  //
  // These facts are why it works:
  //
  //  If n is even, then x^n = (x^2)^(n/2).
  //  If n is odd,  then x^n = x * x^(n-1),
  //   and applying the equation for even x gives
  //    x^n = x * (x^2)^((n-1) / 2).
  //
  //  Also, EVM division is flooring and
  //    floor[(n-1) / 2] = floor[n / 2].
  //
  function rpow(uint256 x, uint256 n) internal pure returns (uint256 z) {
    z = n % 2 != 0 ? x : RAY;

    for (n /= 2; n != 0; n /= 2) {
      x = rmul(x, x);

      if (n % 2 != 0) {
        z = rmul(z, x);
      }
    }
  }
}
