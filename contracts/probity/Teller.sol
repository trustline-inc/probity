// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/Stateful.sol";
import "../Dependencies/DSMath.sol";
import "../Dependencies/Base.sol";

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

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(address registryAddress, VaultLike vaultAddress)
    Stateful(registryAddress)
  {
    vault = vaultAddress;
    APR = RAY;
    MPR = RAY;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function initCollType(bytes32 collId) external onlyByRegistered {
    collTypes[collId].lastUpdated = block.timestamp;
  }

  function updateAccumulator(bytes32 collId) external {
    require(
      collTypes[collId].lastUpdated != 0,
      "TELLER: Collateral Type not initialized"
    );

    Collateral memory coll = collTypes[collId];
    (uint256 debtAccumulator, uint256 suppAccumulator) =
      vault.collTypes(collId);
    uint256 totalDebt = vault.totalDebt();
    uint256 totalSupply = vault.totalSupply();

    // Update debt accumulator
    if (coll.lastUtilization > 0)
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
    // @todo we need to cap utilization at 100%, either hard capped it at 100% or we need to separate system debt from normal debt
    coll.lastUtilization = wdiv(totalDebt, totalSupply);
    uint256 round = 0.0025 * 10**27;
    uint256 oneMinusUtilization = sub(RAY, coll.lastUtilization * 1e9);
    uint256 oneDividedByOneMinusUtilization =
      rdiv(10**27 * 0.01, oneMinusUtilization);
    APR = add(oneDividedByOneMinusUtilization, RAY);
    APR = ((APR + round - 1) / round) * round;
    require(APR <= MAX_APR, "TELLER: Max APR exceeed");

    // Set new MPR
    MPR = APR_TO_MPR[APR];

    // Update time index
    coll.lastUpdated = block.timestamp;

    vault.updateAccumulators(collId, debtAccumulator, suppAccumulator);
    collTypes[collId] = coll;
  }
}
