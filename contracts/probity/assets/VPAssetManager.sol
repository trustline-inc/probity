// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../../dependencies/Delegatable.sol";

contract VPAssetManager is Delegatable {
    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event DepositVPAssetManager(address indexed user, uint256 amount, address indexed token);
    event WithdrawVPAssetManager(address indexed user, uint256 amount, address indexed token);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        bytes32 collateralHash,
        FtsoManagerLike ftsoManagerAddress,
        FtsoRewardManagerLike rewardManagerAddress,
        VPTokenManagerLike tokenAddress,
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
    // solhint-disable-next-line
    {

    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    function deposit(uint256 amount) external onlyWhen("paused", false) {
        SafeERC20.safeTransferFrom(IERC20(address(token)), msg.sender, address(this), amount);

        vaultEngine.modifyStandbyAmount(assetId, msg.sender, int256(amount));
        uint256 currentRewardEpoch = ftsoManager.getCurrentRewardEpoch();
        recentDeposits[msg.sender][currentRewardEpoch] += amount;
        recentTotalDeposit[msg.sender] += amount;
        totalDepositsForEpoch[currentRewardEpoch] += int256(amount);

        emit DepositVPAssetManager(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        SafeERC20.safeTransfer(IERC20(address(token)), msg.sender, amount);

        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -int256(amount));

        uint256 currentRewardEpoch = ftsoManager.getCurrentRewardEpoch();
        totalDepositsForEpoch[currentRewardEpoch] -= int256(amount);

        // only reduce recentDeposits if it exists
        if (recentDeposits[msg.sender][currentRewardEpoch] >= amount) {
            recentDeposits[msg.sender][currentRewardEpoch] -= amount;
            recentTotalDeposit[msg.sender] -= amount;
        } else if (recentDeposits[msg.sender][currentRewardEpoch] > 0) {
            recentTotalDeposit[msg.sender] -= recentDeposits[msg.sender][currentRewardEpoch];
            recentDeposits[msg.sender][currentRewardEpoch] -= 0;
        }

        emit WithdrawVPAssetManager(msg.sender, amount, address(token));
    }
}
