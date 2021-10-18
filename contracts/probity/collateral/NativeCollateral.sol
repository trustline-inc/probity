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
  // Events
  /////////////////////////////////////////

  event Deposit(address indexed user, uint256 amount);
  event Withdrawal(address indexed user, uint256 amount);

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
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) external onlyWhen("paused", false) {
    vaultEngine.modifyCollateral(collateralId, msg.sender, -int256(amount));
    require(
      payable(msg.sender).send(amount),
      "NativeCollateral/withdraw: fail to send FLR"
    );

    emit Withdrawal(msg.sender, amount);
  }
}
