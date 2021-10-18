// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";

interface VaultEngineLike {
  function addAurei(address user, uint256 amount) external;

  function removeAurei(address user, uint256 amount) external;

  function removeTcn(address user, uint256 amount) external;
}

interface TokenLike {
  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function mint(address user, uint256 amount) external;

  function burn(address user, uint256 amount) external;
}

contract Treasury is Stateful {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////

  event DepositAurei(address indexed user, uint256 amount);
  event WithdrawAurei(address indexed user, uint256 amount);
  event WithdrawTcn(address indexed user, uint256 amount);
  event ExchangeTcn(address indexed user, uint256 amount);

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////

  TokenLike public aurei;
  TokenLike public tcn;
  VaultEngineLike public vaultEngine;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(
    address registryAddress,
    TokenLike aureiAddress,
    TokenLike tcnAddress,
    VaultEngineLike vaultEngineAddress
  ) Stateful(registryAddress) {
    aurei = aureiAddress;
    vaultEngine = vaultEngineAddress;
    tcn = tcnAddress;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function deposit(uint256 amount) external {
    vaultEngine.addAurei(msg.sender, amount * 1e27);
    aurei.burn(msg.sender, amount);
    emit DepositAurei(msg.sender, amount);
  }

  function withdrawAurei(uint256 amount) external {
    vaultEngine.removeAurei(msg.sender, amount * 1e27);
    aurei.mint(msg.sender, amount);
    emit WithdrawAurei(msg.sender, amount);
  }

  function withdrawTcn(uint256 amount) external {
    vaultEngine.removeTcn(msg.sender, amount * 1e27);
    tcn.mint(msg.sender, amount);
    emit WithdrawTcn(msg.sender, amount);
  }

  function exchangeTcn(uint256 amount) external {
    tcn.burn(msg.sender, amount);
    aurei.mint(msg.sender, amount);
    emit ExchangeTcn(msg.sender, amount);
  }
}
