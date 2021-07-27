// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../Dependencies/Stateful.sol";
import "../../Interfaces/ICollateral.sol";

interface VaultLike {
  function modifyCollateral(
    bytes32 collateral,
    address user,
    int256 amount
  ) external;
}

contract FLRCollateral is Stateful, ICollateral {
  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  bytes32 collateralId;
  VaultLike vault;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(
    address registryAddress,
    bytes32 collateralHash,
    VaultLike vaultAddress
  ) Stateful(registryAddress) {
    collateralId = collateralHash;
    vault = vaultAddress;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function deposit() external payable onlyWhen("paused", false) {
    vault.modifyCollateral(collateralId, msg.sender, int256(msg.value));
  }

  function withdraw(uint256 amount) external onlyWhen("paused", false) {
    require(payable(msg.sender).send(amount), "FLR_COLL: fail to send FLR");
    vault.modifyCollateral(collateralId, msg.sender, -int256(amount));
  }
}
