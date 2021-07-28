// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/Stateful.sol";

interface VaultLike {
  function moveAurei(
    address from,
    address to,
    uint256 amount
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

contract Treasury is Stateful {
  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////

  TokenLike aurei;
  VaultLike vault;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(
    address registryAddress,
    TokenLike aureiAddress,
    VaultLike vaultAddress
  ) Stateful(registryAddress) {
    aurei = aureiAddress;
    vault = vaultAddress;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function deposit(uint256 amount) external {
    vault.moveAurei(address(this), msg.sender, amount);
    aurei.burn(msg.sender, amount);
  }

  function withdraw(address destination, uint256 amount) external {
    vault.moveAurei(msg.sender, address(this), amount);
    aurei.mint(destination, amount);
  }
}
