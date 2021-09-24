// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/DSMath.sol";
import "../dependencies/Base.sol";

interface VaultLike {
  function collTypes(bytes32)
    external
    returns (uint256 debtAccumulator, uint256 suppAccumulator);

  function totalDebt() external returns (uint256);

  function totalSupply() external returns (uint256);

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
contract Teller is Stateful, DSMath, Base {
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

  mapping(bytes32 => Collateral) collTypes;

  uint256 public APR; // Annualized percentage rate
  uint256 public MPR; // Momentized percentage rate
  VaultLike vault;
  IAPR public lowAprRate;
  IAPR public highAprRate;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(
    address registryAddress,
    VaultLike vaultAddress,
    IAPR lowAprAddress,
    IAPR highAprAddress
  ) Stateful(registryAddress) {
    vault = vaultAddress;
    lowAprRate = lowAprAddress;
    highAprRate = highAprAddress;
    APR = RAY;
    MPR = RAY;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function initCollType(bytes32 collId) external onlyBy("gov") {
    collTypes[collId].lastUpdated = block.timestamp;
  }

  /**
   * @dev Updates the debt and capital indices
   */
  function updateAccumulator(bytes32 collId) external {
    require(
      collTypes[collId].lastUpdated != 0,
      "TELLER: Collateral Type not initialized"
    );

    Collateral memory coll = collTypes[collId];
    (uint256 debtAccumulator, uint256 suppAccumulator) = vault.collTypes(
      collId
    );
    uint256 totalDebt = vault.totalDebt();
    uint256 totalSupply = vault.totalSupply();

    // Update debt accumulator
    if (coll.lastUtilization > 0)
      debtAccumulator = rmul(
        rpow(MPR, (block.timestamp - coll.lastUpdated)),
        debtAccumulator
      );

    // Update capital accumulator
    uint256 multipliedByUtilization = rmul(
      sub(MPR, RAY),
      coll.lastUtilization * 1e9
    );
    uint256 multipliedByUtilizationPlusOne = add(multipliedByUtilization, RAY);
    uint256 exponentiated = rpow(
      multipliedByUtilizationPlusOne,
      (block.timestamp - coll.lastUpdated)
    );
    suppAccumulator = rmul(exponentiated, suppAccumulator);

    // Set new APR (round to nearest 0.25%)
    coll.lastUtilization = wdiv(totalDebt, totalSupply);
    uint256 round = 0.0025 * 10**27;
    uint256 oneMinusUtilization = sub(RAY, coll.lastUtilization * 1e9);
    uint256 oneDividedByOneMinusUtilization = rdiv(
      10**27 * 0.01,
      oneMinusUtilization
    );
    APR = add(oneDividedByOneMinusUtilization, RAY);
    APR = ((APR + round - 1) / round) * round;
    require(APR <= MAX_APR, "TELLER: Max APR exceeed");

    // Set new MPR
    if (APR > 1500000000000000000000000000) {
      MPR = highAprRate.APR_TO_MPR(APR);
    } else {
      MPR = lowAprRate.APR_TO_MPR(APR);
    }

    // Update time index
    coll.lastUpdated = block.timestamp;

    vault.updateAccumulators(collId, debtAccumulator, suppAccumulator);
    collTypes[collId] = coll;
  }
}
