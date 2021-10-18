// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../dependencies/Delegatable.sol";

contract VPTokenCollateral is Delegatable {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////

  event DepositVPToken(
    address indexed user,
    uint256 amount,
    address indexed token
  );
  event WithdrawVPToken(
    address indexed user,
    uint256 amount,
    address indexed token
  );

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(
    address registryAddress,
    bytes32 collateralHash,
    FtsoManagerLike ftsoManagerAddress,
    FtsoRewardManagerLike rewardManagerAddress,
    VPTokenLike tokenAddress,
    VaultEngineLike vaultEngineAddress
  )
    Delegatable(
      registryAddress,
      collateralHash,
      ftsoManagerAddress,
      rewardManagerAddress,
      tokenAddress,
      vaultEngineAddress
    )
  {}

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function deposit(uint256 amount) external onlyWhen("paused", false) {
    require(
      token.transferFrom(msg.sender, address(this), amount),
      "VPTokenCollateral/deposit: transfer failed"
    );
    vaultEngine.modifyCollateral(collId, msg.sender, int256(amount));
    recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] += amount;
    recentTotalDeposit[msg.sender] += amount;

    emit DepositVPToken(msg.sender, amount, address(token));
  }

  function withdraw(uint256 amount) external onlyWhen("paused", false) {
    require(
      token.transfer(msg.sender, amount),
      "VPTokenCollateral/withdraw: transfer failed"
    );

    vaultEngine.modifyCollateral(collId, msg.sender, -int256(amount));
    // only reduce recentDeposits if it exists
    if (
      recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] >= amount
    ) {
      recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] -= amount;
      recentTotalDeposit[msg.sender] -= amount;
    } else if (
      recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] > 0
    ) {
      recentTotalDeposit[msg.sender] -= recentDeposits[msg.sender][
        ftsoManager.getCurrentRewardEpoch()
      ];
      recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] -= 0;
    }

    emit WithdrawVPToken(msg.sender, amount, address(token));
  }
}
