// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";

interface VaultEngineLike {
  function moveAurei(
    address from,
    address to,
    uint256 amount
  ) external;

  function reduceYield(address user, uint256 amount) external;
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

  event Deposit(address indexed user, uint256 amount);
  event Withdrawal(address indexed user, uint256 amount);

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
    vaultEngine.moveAurei(address(this), msg.sender, amount);
    aurei.burn(msg.sender, amount);
    emit Deposit(msg.sender, amount);
  }

  function withdrawAurei(uint256 amount) external {
    vaultEngine.moveAurei(msg.sender, address(this), amount);
    aurei.mint(msg.sender, amount);
    emit Withdrawal(msg.sender, amount);
  }

  function withdrawTcn(uint256 amount) external {
    vaultEngine.reduceYield(msg.sender, amount);
    tcn.mint(msg.sender, amount);
    // TODO: #69 Emit event for TCN withdrawal
  }

  function tradeTcnforAurei(uint256 amount) external {
    tcn.burn(msg.sender, amount);
    aurei.mint(msg.sender, amount);
  }
}
