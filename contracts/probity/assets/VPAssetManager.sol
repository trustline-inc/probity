// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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
        VPAssetManagerLike tokenAddress,
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

    function deposit(uint256 amount) external onlyWhen("paused", false) onlyByWhiteListed {
        require(token.transferFrom(msg.sender, address(this), amount), "VPAssetManager/deposit: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, int256(amount));
        recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] += amount;
        recentTotalDeposit[msg.sender] += amount;

        emit DepositVPAssetManager(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) {
        require(token.transfer(msg.sender, amount), "VPAssetManager/withdraw: transfer failed");

        vaultEngine.modifyStandbyAsset(assetId, msg.sender, -int256(amount));
        // only reduce recentDeposits if it exists
        if (recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] >= amount) {
            recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] -= amount;
            recentTotalDeposit[msg.sender] -= amount;
        } else if (recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] > 0) {
            recentTotalDeposit[msg.sender] -= recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()];
            recentDeposits[msg.sender][ftsoManager.getCurrentRewardEpoch()] -= 0;
        }

        emit WithdrawVPAssetManager(msg.sender, amount, address(token));
    }
}
