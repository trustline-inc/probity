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

interface TokenLike {
  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}

contract ERC20Collateral is Stateful, ICollateral {
  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  bytes32 collateralId;
  VaultLike vault;
  TokenLike collateralToken;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(
    address registryAddress,
    bytes32 collateralHash,
    TokenLike collateral,
    VaultLike vaultAddress
  ) Stateful(registryAddress) {
    collateralId = collateralHash;
    vault = vaultAddress;
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
    vault.modifyCollateral(collateralId, msg.sender, int256(amount));
  }

  function withdraw(uint256 amount) external onlyWhen("paused", false) {
    require(
      collateralToken.transfer(msg.sender, amount),
      "ERC20_COLL: transfer failed"
    );
    vault.modifyCollateral(collateralId, msg.sender, -int256(amount));
  }
}
