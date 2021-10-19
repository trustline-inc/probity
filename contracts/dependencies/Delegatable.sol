// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Stateful.sol";

interface FtsoRewardManagerLike {
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

interface FtsoManagerLike {
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

interface VaultEngineLike {
  function vaults(bytes32 collId, address user)
    external
    returns (uint256 freeColl, uint256 lockedColl);

  function modifyCollateral(
    bytes32 collateral,
    address user,
    int256 amount
  ) external;
}

contract Delegatable is Stateful {
  FtsoManagerLike public ftsoManager;
  FtsoRewardManagerLike public ftsoRewardManager;
  VaultEngineLike public vaultEngine;
  VPTokenLike public token;
  bytes32 public collId;
  address[] public dataProviders;
  uint256 public lastClaimedEpoch;
  mapping(uint256 => uint256) public contractBalanceByEpoch;
  mapping(uint256 => uint256) public rewardPerUnitAtEpoch;
  uint256 private constant HUNDRED_PERCENT = 10000;
  uint256 constant RAY = 1e27;

  mapping(address => uint256) public userLastClaimedEpoch;
  mapping(address => uint256) public recentTotalDeposit;
  mapping(address => mapping(uint256 => uint256)) public recentDeposits; // maybe a different data structure?

  constructor(
    address registryAddress,
    bytes32 collateralId,
    FtsoManagerLike ftsoManagerAddress,
    FtsoRewardManagerLike rewardManagerAddress,
    VPTokenLike tokenAddress,
    VaultEngineLike vaultEngineAddress
  ) Stateful(registryAddress) {
    collId = collateralId;
    ftsoManager = ftsoManagerAddress;
    ftsoRewardManager = rewardManagerAddress;
    vaultEngine = vaultEngineAddress;
    token = tokenAddress;
  }

  function claimReward() external {
    require(
      ftsoManager.getCurrentRewardEpoch() > lastClaimedEpoch,
      "Delegatable/claimReward: No new epoch to claim"
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
      "Delegatable/userCollectReward: No new epoch to claim"
    );
    (uint256 freeColl, uint256 lockedColl) =
      vaultEngine.vaults(collId, msg.sender);
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
    onlyBy("gov")
  {
    require(
      providers.length == pct.length,
      "Delegatable/changeDataProviders: Length of providers and pct mismatch"
    );
    uint256 totalPct = 0;
    for (uint256 index = 0; index <= providers.length; index++) {
      token.delegate(providers[index], pct[index]);
      totalPct += pct[index];
    }
    require(
      totalPct == HUNDRED_PERCENT,
      "Delegatable/changeDataProviders: Provided percentages does not add up to 100%"
    );
    dataProviders = providers;
  }

  function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
    z = ((x * RAY) + (y / 2)) / y;
  }
}
