// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../dependencies/Stateful.sol";

interface TokenLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);
}

interface VaultEngineLike {
    function modifyStandbyAsset(
        bytes32 collateral,
        address user,
        int256 amount
    ) external;
}

contract MockErc20AssetManager is Stateful {
    TokenLike public immutable token;
    bytes32 public immutable assetId;
    VaultEngineLike public vaultEngine;

    event DepositToken(address indexed user, uint256 amount, address indexed token);
    event WithdrawToken(address indexed user, uint256 amount, address indexed token);

    constructor(
        address registryAddress,
        bytes32 id,
        TokenLike asset
    ) Stateful(registryAddress) {
        assetId = id;
        token = asset;
    }

    function setVaultEngine(VaultEngineLike _vaultEngine) external {
        vaultEngine = _vaultEngine;
    }

    function deposit(uint256 amount) external onlyWhen("paused", false) onlyBy("whitelisted") {
        require(token.transferFrom(msg.sender, address(this), amount), "ERC20AssetManager/deposit: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, int256(amount));
        emit DepositToken(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) onlyBy("whitelisted") {
        require(token.transfer(msg.sender, amount), "ERC20AssetManager/withdraw: transfer failed");
        vaultEngine.modifyStandbyAsset(assetId, msg.sender, -int256(amount));
        emit WithdrawToken(msg.sender, amount, address(token));
    }
}
