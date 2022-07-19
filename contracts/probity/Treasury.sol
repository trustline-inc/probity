// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";

interface VaultEngineLike {
    function addStablecoin(address user, uint256 amount) external;

    function removeStablecoin(address user, uint256 amount) external;

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;

    function reducePbt(address user, uint256 amount) external;
}

interface TokenLike {
    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function mint(address user, uint256 amount) external;

    function burn(address user, uint256 amount) external;
}

/**
 * @title Treasury Contract
 * @notice Treasury exchanges the stablecoin/pbt balances between the VaultEngine and their ERC20 counterpart
 */
contract Treasury is Stateful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////

    TokenLike public immutable stablecoin;
    TokenLike public immutable pbt;
    VaultEngineLike public immutable vaultEngine;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event DepositStablecoin(address indexed user, uint256 amount);
    event WithdrawStablecoin(address indexed user, uint256 amount);
    event TransferStablecoin(address indexed from, address indexed to, uint256 amount);
    event WithdrawPbt(address indexed user, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        TokenLike stablecoinAddress,
        TokenLike pbtAddress,
        VaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        stablecoin = stablecoinAddress;
        vaultEngine = vaultEngineAddress;
        pbt = pbtAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev exchange ERC20 of the stablecoin from user to stablecoin balance in Vault Engine
     * @param amount to exchange
     */
    function depositStablecoin(uint256 amount) external {
        vaultEngine.addStablecoin(msg.sender, amount * 1e27);
        stablecoin.burn(msg.sender, amount);
        emit DepositStablecoin(msg.sender, amount);
    }

    /**
     * @dev exchange the stablecoin balance from Vault to ERC20 version
     * @param amount to exchange
     */
    function withdrawStablecoin(uint256 amount) external {
        vaultEngine.removeStablecoin(msg.sender, amount * 1e27);
        stablecoin.mint(msg.sender, amount);
        emit WithdrawStablecoin(msg.sender, amount);
    }

    /**
     * @dev Transfer stablecoin balance within vault engine to another address
     * @param recipient of the transfer
     * @param amount to transfer
     */
    function transferStablecoin(address recipient, uint256 amount) external {
        vaultEngine.moveStablecoin(msg.sender, recipient, amount * 1e27);
        emit TransferStablecoin(msg.sender, recipient, amount);
    }

    /**
     * @dev withdraw PBT balance from VaultEngine to ERC20 counterpart
     * @param amount to withdraw
     */
    function withdrawPbt(uint256 amount) external {
        vaultEngine.reducePbt(msg.sender, amount * 1e27);
        pbt.mint(msg.sender, amount);
        emit WithdrawPbt(msg.sender, amount);
    }
}
