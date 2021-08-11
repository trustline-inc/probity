// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../../Dependencies/DSMath.sol";

interface FtsoRewardManager {
  function claimRewardFromDataProviders(
    address payable _recipient,
    uint256[] memory _rewardEpochs,
    address[] memory _dataProviders
  ) external returns (uint256 _rewardAmount);

  function getEpochsWithClaimableRewards()
    external
    view
    returns (uint256 _startEpochId, uint256 _endEpochId);
}

interface FtsoManager {
  function getCurrentRewardEpoch() external view returns (uint256);
}

interface VPTokenLike {
  function transfer(address recipient, uint256 amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function delegate(address _to, uint256 _bips) external;
}

interface VaultLike {
  function vaults(bytes32 collId, address user)
    external
    returns (uint256 freeColl, uint256 lockedColl);

  function modifyCollateral(
    bytes32 collateral,
    address user,
    int256 amount
  ) external;
}

contract Delegatable is DSMath {
  FtsoManager ftsoManager;
  FtsoRewardManager ftsoRewardManager;
  VaultLike vault;
  VPTokenLike token;
  bytes32 collId;
  address[] dataProviders;
  uint256 lastClaimedEpoch;
  mapping(uint256 => uint256) contractBalanceByEpoch;
  mapping(uint256 => uint256) rewardPerUnitAtEpoch;
  uint256 constant HUNDRED_PERCENT = 10000;

  mapping(address => uint256) userLastClaimedEpoch;
  mapping(address => uint256) recentTotalDeposit;
  mapping(address => mapping(uint256 => uint256)) recentDeposits; // maybe a different data structure?

  constructor(
    bytes32 collateralId,
    FtsoManager ftsoManagerAddress,
    FtsoRewardManager rewardManagerAddress,
    VPTokenLike tokenAddress,
    VaultLike vaultAddress
  ) {
    collId = collateralId;
    ftsoManager = ftsoManagerAddress;
    ftsoRewardManager = rewardManagerAddress;
    vault = vaultAddress;
    token = tokenAddress;
  }

  function claimReward() external {
    require(
      ftsoManager.getCurrentRewardEpoch() > lastClaimedEpoch,
      "No new epoch to claim"
    );
    (uint256 startEpochId, uint256 endEpochId) =
      ftsoRewardManager.getEpochsWithClaimableRewards();
    for (uint256 epochId = startEpochId; epochId <= endEpochId; epochId++) {
      uint256[] memory epochs;
      epochs[0] = epochId;

      uint256 rewardAmount =
        ftsoRewardManager.claimRewardFromDataProviders(
          payable(address(this)),
          epochs,
          dataProviders
        );

      rewardPerUnitAtEpoch[epochId] = rdiv(
        rewardAmount,
        contractBalanceByEpoch[epochId]
      );
    }

    lastClaimedEpoch = ftsoManager.getCurrentRewardEpoch();
  }

  function userCollectReward() external {
    require(
      lastClaimedEpoch > userLastClaimedEpoch[msg.sender],
      "No new epoch to claim"
    );
    (uint256 freeColl, uint256 lockedColl) = vault.vaults(collId, msg.sender);
    uint256 currentBalance = freeColl + lockedColl;
    uint256 rewardBalance = 0;

    for (
      uint256 userEpoch = userLastClaimedEpoch[msg.sender];
      userEpoch <= ftsoManager.getCurrentRewardEpoch();
      userEpoch++
    ) {
      uint256 rewardableBalance =
        currentBalance - recentTotalDeposit[msg.sender];
      recentTotalDeposit[msg.sender] -= recentDeposits[msg.sender][userEpoch];
      rewardBalance += rewardPerUnitAtEpoch[userEpoch] * rewardableBalance;
      delete recentDeposits[msg.sender][userEpoch];
    }

    userLastClaimedEpoch[msg.sender] = lastClaimedEpoch;
  }

  function changeDataProviders(address[] memory providers, uint256[] memory pct)
    external
  {
    require(
      providers.length == pct.length,
      "Length of providers and pct mismatch"
    );
    uint256 totalPct = 0;
    for (uint256 index = 0; index <= providers.length; index++) {
      token.delegate(providers[index], pct[index]);
      totalPct += pct[index];
    }
    require(
      totalPct == HUNDRED_PERCENT,
      "Provided percentages does not add up to 100%"
    );
    dataProviders = providers;
  }
}
