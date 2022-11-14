// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "../deps/Stateful.sol";

interface LedgerLike {
    function addSystemCurrency(address user, uint256 amount) external;

    function removeSystemCurrency(address user, uint256 amount) external;

    function moveSystemCurrency(address from, address to, uint256 amount) external;
}

interface TokenLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    function mint(address user, uint256 amount) external;

    function burn(address user, uint256 amount) external;
}

/**
 * @title Treasury Contract
 * @notice Treasury exchanges the system currency balance between the VaultEngine and ERC20 counterpart
 */
contract Treasury is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////

    TokenLike public immutable systemCurrency;
    LedgerLike public immutable ledger;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event DepositSystemCurrency(address indexed user, uint256 amount);
    event WithdrawSystemCurrency(address indexed user, uint256 amount);
    event TransferSystemCurrency(address indexed from, address indexed to, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        TokenLike systemCurrencyAddress,
        LedgerLike ledgerAddress
    ) Stateful(registryAddress) {
        systemCurrency = systemCurrencyAddress;
        ledger = ledgerAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev exchange ERC20 of the systemCurrency from user to systemCurrency balance in Vault Engine
     * @param amount to exchange
     */
    function depositSystemCurrency(uint256 amount) external onlyWhen("paused", false) {
        ledger.addSystemCurrency(msg.sender, amount * 1e27);
        systemCurrency.burn(msg.sender, amount);
        emit DepositSystemCurrency(msg.sender, amount);
    }

    /**
     * @dev exchange the systemCurrency balance from Vault to ERC20 version
     * @param amount to exchange
     */
    function withdrawSystemCurrency(uint256 amount) external onlyWhen("paused", false) {
        ledger.removeSystemCurrency(msg.sender, amount * 1e27);
        systemCurrency.mint(msg.sender, amount);
        emit WithdrawSystemCurrency(msg.sender, amount);
    }

    /**
     * @dev Transfer systemCurrency balance within vault engine to another address
     * @param recipient of the transfer
     * @param amount to transfer
     */
    function transferSystemCurrency(address recipient, uint256 amount) external onlyWhen("paused", false) {
        ledger.moveSystemCurrency(msg.sender, recipient, amount * 1e27);
        emit TransferSystemCurrency(msg.sender, recipient, amount);
    }
}
