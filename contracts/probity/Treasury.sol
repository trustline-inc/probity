// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../dependencies/Stateful.sol";
import "../interfaces/IVaultEngineLike.sol";
import "../interfaces/ITokenLike.sol";

/**
 * @title Treasury Contract
 * @notice Treasury exchanges the systemCurrency/pbt balances between the VaultEngine and their ERC20 counterpart
 */
contract Treasury is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////

    ITokenLike public immutable systemCurrency;
    ITokenLike public immutable pbt;
    IVaultEngineLike public immutable vaultEngine;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event DepositSystemCurrency(address indexed user, uint256 amount);
    event WithdrawSystemCurrency(address indexed user, uint256 amount);
    event TransferSystemCurrency(address indexed from, address indexed to, uint256 amount);
    event WithdrawPbt(address indexed user, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        ITokenLike systemCurrencyAddress,
        ITokenLike pbtAddress,
        IVaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        systemCurrency = systemCurrencyAddress;
        vaultEngine = vaultEngineAddress;
        pbt = pbtAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev exchange ERC20 of the systemCurrency from user to systemCurrency balance in Vault Engine
     * @param amount to exchange
     */
    function depositSystemCurrency(uint256 amount) external onlyWhen("paused", false) {
        vaultEngine.addSystemCurrency(msg.sender, amount * 1e27);
        systemCurrency.burn(msg.sender, amount);
        emit DepositSystemCurrency(msg.sender, amount);
    }

    /**
     * @dev exchange the systemCurrency balance from Vault to ERC20 version
     * @param amount to exchange
     */
    function withdrawSystemCurrency(uint256 amount) external onlyWhen("paused", false) {
        vaultEngine.removeSystemCurrency(msg.sender, amount * 1e27);
        systemCurrency.mint(msg.sender, amount);
        emit WithdrawSystemCurrency(msg.sender, amount);
    }

    /**
     * @dev Transfer systemCurrency balance within vault engine to another address
     * @param recipient of the transfer
     * @param amount to transfer
     */
    function transferSystemCurrency(address recipient, uint256 amount) external onlyWhen("paused", false) {
        vaultEngine.moveSystemCurrency(msg.sender, recipient, amount * 1e27);
        emit TransferSystemCurrency(msg.sender, recipient, amount);
    }

    /**
     * @dev withdraw PBT balance from VaultEngine to ERC20 counterpart
     * @param amount to withdraw
     */
    function withdrawPbt(uint256 amount) external onlyWhen("paused", false) {
        vaultEngine.reducePbt(msg.sender, amount * 1e27);
        pbt.mint(msg.sender, amount);
        emit WithdrawPbt(msg.sender, amount);
    }
}
