// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../dependencies/Stateful.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../interfaces/IVaultEngineLike.sol";
import "../interfaces/ITokenLike.sol";

contract MockErc20AssetManager is Stateful {
    ITokenLike public immutable token;
    bytes32 public immutable assetId;
    IVaultEngineLike public vaultEngine;

    event DepositToken(address indexed user, uint256 amount, address indexed token);
    event WithdrawToken(address indexed user, uint256 amount, address indexed token);

    error transferFailed();

    constructor(
        address registryAddress,
        bytes32 id,
        ITokenLike asset
    ) Stateful(registryAddress) {
        assetId = id;
        token = asset;
    }

    function setVaultEngine(IVaultEngineLike _vaultEngine) external {
        vaultEngine = _vaultEngine;
    }

    function deposit(uint256 amount) external onlyWhen("paused", false) onlyBy("whitelisted") {
        if (!token.transferFrom(msg.sender, address(this), amount)) revert transferFailed();
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, SafeCast.toInt256(amount));
        emit DepositToken(msg.sender, amount, address(token));
    }

    function withdraw(uint256 amount) external onlyWhen("paused", false) onlyBy("whitelisted") {
        if (!token.transfer(msg.sender, amount)) revert transferFailed();
        vaultEngine.modifyStandbyAmount(assetId, msg.sender, -SafeCast.toInt256(amount));
        emit WithdrawToken(msg.sender, amount, address(token));
    }
}
