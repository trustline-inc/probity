// SPDX-License-Identifier: MIT

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
    event ExchangePbt(address indexed user, uint256 amount);

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
    function depositStablecoin(uint256 amount) external {
        vaultEngine.addStablecoin(msg.sender, amount);
        stablecoin.burn(msg.sender, amount / 1e27);
        emit DepositStablecoin(msg.sender, amount);
    }

    function withdrawStablecoin(uint256 amount) external {
        vaultEngine.removeStablecoin(msg.sender, amount);
        stablecoin.mint(msg.sender, amount / 1e27);
        emit WithdrawStablecoin(msg.sender, amount);
    }

    function transferStablecoin(address recipient, uint256 amount) external {
        vaultEngine.moveStablecoin(msg.sender, recipient, amount);
        emit TransferStablecoin(msg.sender, recipient, amount);
    }

    function withdrawPbt(uint256 amount) external {
        vaultEngine.reducePbt(msg.sender, amount);
        pbt.mint(msg.sender, amount / 1e27);
        emit WithdrawPbt(msg.sender, amount);
    }
}
