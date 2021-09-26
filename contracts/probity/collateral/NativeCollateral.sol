// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../dependencies/Stateful.sol";

interface VaultEngineLike {
  function modifyCollateral(
    bytes32 collateral,
    address user,
    int256 amount
  ) external;
}

contract NativeCollateral is Stateful {
  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  bytes32 collateralId;
  VaultEngineLike vaultEngine;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(
    address registryAddress,
    bytes32 collId,
    VaultEngineLike vaultEngineAddress
  ) Stateful(registryAddress) {
    collateralId = collId;
    vaultEngine = vaultEngineAddress;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function deposit() external payable onlyWhen("paused", false) {
    vaultEngine.modifyCollateral(collateralId, msg.sender, int256(msg.value));
  }

  function withdraw(uint256 amount) external onlyWhen("paused", false) {
    require(payable(msg.sender).send(amount), "FLR_COLL: fail to send FLR");
    vaultEngine.modifyCollateral(collateralId, msg.sender, -int256(amount));
  }
}
