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

interface TokenLike {
  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}

contract ERC20Collateral is Stateful {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////

  event DepositToken(
    address indexed user,
    uint256 amount,
    address indexed token
  );
  event WithdrawToken(
    address indexed user,
    uint256 amount,
    address indexed token
  );

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  bytes32 collateralId;
  VaultEngineLike vaultEngine;
  TokenLike collateralToken;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(
    address registryAddress,
    bytes32 collId,
    TokenLike collateral,
    VaultEngineLike vaultEngineAddress
  ) Stateful(registryAddress) {
    collateralId = collId;
    vaultEngine = vaultEngineAddress;
    collateralToken = collateral;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function deposit(uint256 amount) external onlyWhen("paused", false) {
    require(
      collateralToken.transferFrom(msg.sender, address(this), amount),
      "ERC20_COLL: transfer failed"
    );
    vaultEngine.modifyCollateral(collateralId, msg.sender, int256(amount));
    emit DepositToken(msg.sender, amount, address(collateralToken));
  }

  function withdraw(uint256 amount) external onlyWhen("paused", false) {
    require(
      collateralToken.transfer(msg.sender, amount),
      "ERC20_COLL: transfer failed"
    );
    vaultEngine.modifyCollateral(collateralId, msg.sender, -int256(amount));
    emit WithdrawToken(msg.sender, amount, address(collateralToken));
  }
}
