// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Stateful.sol";
import "./Math.sol";

interface FtsoRewardManagerLike {
    function claimRewardFromDataProviders(
        address payable _recipient,
        uint256[] memory _rewardEpochs,
        address[] memory _dataProviders
    ) external returns (uint256 _rewardAmount);

    function getEpochsWithClaimableRewards() external view returns (uint256 _startEpochId, uint256 _endEpochId);
}

interface FtsoManagerLike {
    function getCurrentRewardEpoch() external view returns (uint256);
}

interface VPTokenManagerLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function delegate(address _to, uint256 _bips) external;
}

interface VaultEngineLike {
    function vaults(bytes32 assetId, address user)
        external
        returns (
            uint256 standbyAmount,
            uint256 underlying,
            uint256 collateral
        );

    function modifyStandbyAmount(
        bytes32 assetId,
        address user,
        int256 amount
    ) external;
}

/**
 * @title Delegatable Contract
 * @notice This contract handles the delegate and claim rewards actions for VP token
 */

contract Delegatable is Stateful {
    ///////////////////////////////////
    // State Variables
    ///////////////////////////////////
    uint256 private constant HUNDRED_PERCENT = 10000;
    uint256 private constant RAY = 1e27;

    FtsoManagerLike public immutable ftsoManager;
    FtsoRewardManagerLike public immutable ftsoRewardManager;
    VaultEngineLike public immutable vaultEngine;
    VPTokenManagerLike public immutable token;
    bytes32 public immutable assetId;

    address[] public dataProviders; // List of data providers to delegate voting power
    uint256 public lastClaimedEpoch; // Epoch in which the last reward was claimed
    mapping(uint256 => uint256) public totalBalanceAtEpoch;
    mapping(uint256 => int256) public totalDepositsForEpoch;
    mapping(uint256 => uint256) public rewardPerUnitForEpoch; // Reward multiplier for each epoch
    mapping(address => uint256) public userLastClaimedEpoch; // user's last claimed Epoch
    mapping(address => uint256) public recentTotalDeposit; // user's total recent deposit since last claimed epoch
    mapping(address => mapping(uint256 => uint256)) public recentDeposits; // user's recent deposit during each epoch

    ///////////////////////////////////
    // Errors
    ///////////////////////////////////

    error noEpochToClaim();
    error providerAndPctLengthMismatch();
    error pctDoesNotAddUpToHundred();

    ///////////////////////////////////
    // Constructor
    ///////////////////////////////////
    constructor(
        address registryAddress,
        bytes32 collateralId,
        FtsoManagerLike ftsoManagerAddress,
        FtsoRewardManagerLike rewardManagerAddress,
        VPTokenManagerLike tokenAddress,
        VaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        assetId = collateralId;
        ftsoManager = ftsoManagerAddress;
        ftsoRewardManager = rewardManagerAddress;
        vaultEngine = vaultEngineAddress;
        token = tokenAddress;
    }

    ///////////////////////////////////
    // Public Functions
    ///////////////////////////////////

    function getEpochsWithClaimableRewards() public view returns (uint256 startEpoch, uint256 endEpochId) {
        return ftsoRewardManager.getEpochsWithClaimableRewards();
    }

    ///////////////////////////////////
    // External Functions
    ///////////////////////////////////

    /**
     * @dev return the data provider list
     */
    function getDataProviders() external view returns (address[] memory _dataProviders) {
        return dataProviders;
    }

    /**
     * @dev claim reward from the delegated providers up to last claimable rewards, use EpochToEnd if there are too many
     *      claimable epochs
     * @param epochToEnd The Last epoch Id to process, if 0 is provided, it'll go to current highest claimable epoch
     *
     */
    function claimReward(uint256 epochToEnd) external {
        (uint256 startEpochId, uint256 endEpochId) = getEpochsWithClaimableRewards();

        if (epochToEnd != 0 && epochToEnd < endEpochId) {
            endEpochId = epochToEnd;
        }

        for (uint256 epochId = startEpochId; epochId <= endEpochId; epochId++) {
            uint256[] memory epochs = new uint256[](1);
            epochs[0] = epochId;

            // we only get reward from each individual
            uint256 rewardAmount = ftsoRewardManager.claimRewardFromDataProviders(
                payable(address(this)),
                epochs,
                dataProviders
            );

            if (epochId != 0) {
                totalBalanceAtEpoch[epochId] = Math._add(
                    totalBalanceAtEpoch[epochId - 1],
                    totalDepositsForEpoch[epochId]
                );
            } else {
                // at epoch 0, totalDepositsForEpoch should not be negative
                totalBalanceAtEpoch[epochId] = uint256(totalDepositsForEpoch[epochId]);
            }

            // reward would be zero if totalBalanceAtEpoch is zero
            if (totalBalanceAtEpoch[epochId] != 0) {
                rewardPerUnitForEpoch[epochId] = Math._rdiv(rewardAmount, totalBalanceAtEpoch[epochId]);
            }
        }

        lastClaimedEpoch = endEpochId;
    }

    /**
     * @dev allow user to collect reward based on their locked up token value, use epochToEnd parameter if there are
     *      too many epochs to process
     * @param epochToEnd stop at this epoch instead of the lastClaimedEpoch, leave zero to process up until
     *        lastClaimedEpoch
     */

    function userCollectReward(uint256 epochToEnd) external onlyWhen("paused", false) {
        if (lastClaimedEpoch <= userLastClaimedEpoch[msg.sender]) revert noEpochToClaim();

        _userCollectReward(epochToEnd, msg.sender);
    }

    /**
     * @dev allow auctioneer to collect reward on behalf of users based on their locked up token value,
     *      use epochToEnd parameter if there are too many epochs to process
     * @param user address of the user's reward to collect
     */
    function collectRewardForUser(address user) external onlyBy("auctioneer") {
        if (lastClaimedEpoch <= userLastClaimedEpoch[user]) {
            // no reward to collect, simply return without throwing error
            return;
        }

        // pass in zero to collect all collectable epoch
        _userCollectReward(0, user);
    }

    /**
     * @dev change the data providers by delegating a certain percentage
     * @param providers list of the data providers to delegate
     * @param pcts list of percentage for the corresponding provider
     *             The pct must add up to 100% (10000)
     */
    function changeDataProviders(address[] memory providers, uint256[] memory pcts) external onlyBy("gov") {
        if (providers.length != pcts.length) revert providerAndPctLengthMismatch();

        uint256 totalPct = 0;

        for (uint256 index = 0; index < providers.length; index++) {
            token.delegate(providers[index], pcts[index]);
            totalPct += pcts[index];
        }

        if (totalPct != HUNDRED_PERCENT) revert pctDoesNotAddUpToHundred();

        dataProviders = providers;
    }

    ///////////////////////////////////
    // Internal Functions
    ///////////////////////////////////

    function _userCollectReward(uint256 epochToEnd, address user) internal {
        (uint256 underlying, uint256 collateral, uint256 standbyAmount) = vaultEngine.vaults(assetId, user);
        uint256 currentBalance = standbyAmount + underlying + collateral;
        uint256 rewardBalance = 0;

        uint256 lastEpoch = lastClaimedEpoch;

        if (epochToEnd != 0 && epochToEnd < lastClaimedEpoch) {
            lastEpoch = epochToEnd;
        }

        for (uint256 epochId = userLastClaimedEpoch[user]; epochId <= lastEpoch; epochId++) {
            uint256 rewardableBalance = 0;

            if (recentTotalDeposit[user] < currentBalance) {
                rewardableBalance = currentBalance - recentTotalDeposit[user];
            }

            recentTotalDeposit[user] -= recentDeposits[user][epochId];
            rewardBalance += (rewardPerUnitForEpoch[epochId] * rewardableBalance) / RAY;

            delete recentDeposits[user][epochId];
        }

        userLastClaimedEpoch[user] = lastEpoch;

        token.transfer(user, rewardBalance);
    }
}
