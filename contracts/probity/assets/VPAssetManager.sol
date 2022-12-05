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
        IFtsoManagerLike ftsoManagerAddress,
        IFtsoRewardManagerLike rewardManagerAddress,
        IVPTokenManagerLike tokenAddress,
        IVaultEngineLike vaultEngineAddress
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

        vaultEngine.modifyStandbyAmount(assetId, msg.sender, SafeCast.toInt256(amount));
        uint256 currentRewardEpoch = ftsoManager.getCurrentRewardEpoch();
        recentDeposits[msg.sender][currentRewardEpoch] += SafeCast.toInt256(amount);
        recentTotalDeposit[msg.sender] += SafeCast.toInt256(amount);
        totalDepositsForEpoch[currentRewardEpoch] += SafeCast.toInt256(amount);

        emit DepositVPAssetManager(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        SafeERC20.safeTransfer(IERC20(address(token)), msg.sender, amount);

        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -SafeCast.toInt256(amount));

        uint256 currentRewardEpoch = ftsoManager.getCurrentRewardEpoch();
        totalDepositsForEpoch[currentRewardEpoch] -= SafeCast.toInt256(amount);

        recentDeposits[msg.sender][currentRewardEpoch] -= SafeCast.toInt256(amount);
        recentTotalDeposit[msg.sender] -= SafeCast.toInt256(amount);

        emit WithdrawVPAssetManager(msg.sender, amount, address(token));
    }
}
