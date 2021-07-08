pragma solidity ^0.8.0;

import "../Dependencies/Pausable.sol";

contract Vault is Pausable {
  struct Collateral {
    uint256 price;
    uint256 debt;
    uint256 debtCeiling;
  }

  struct UserVault {
    uint256 collateralAmount;
    uint256 debt;
    uint256 supplied;
  }

  mapping(bytes32 => Collateral) public collateralTypes;
  mapping(bytes32 => mapping(address => UserVault)) public vaults;

  uint256 totalDebt;
  uint256 totalUnCollateralizedDebt;

  constructor(address registryAddress) Pausable(registryAddress) {}

  function depositCollateral(
    bytes32 collateral,
    address user,
    uint256 amount
  ) external {
    vaults[collateral][user].collateralAmount =
      vaults[collateral][user].collateralAmount +
      amount;
  }

  function withdrawCollateral(
    bytes32 collateral,
    address user,
    uint256 amount
  ) external {
    vaults[collateral][user].collateralAmount =
      vaults[collateral][user].collateralAmount -
      amount;
  }
}
