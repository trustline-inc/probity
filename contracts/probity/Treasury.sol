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

    function removePbt(address user, uint256 amount) external;
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

    TokenLike public immutable aurei;
    TokenLike public immutable pbt;
    VaultEngineLike public immutable vaultEngine;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event DepositAurei(address indexed user, uint256 amount);
    event WithdrawAurei(address indexed user, uint256 amount);
    event TransferAurei(address indexed from, address indexed to, uint256 amount);
    event WithdrawTcn(address indexed user, uint256 amount);
    event ExchangeTcn(address indexed user, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        TokenLike aureiAddress,
        TokenLike tcnAddress,
        VaultEngineLike vaultEngineAddress
    ) Stateful(registryAddress) {
        aurei = aureiAddress;
        vaultEngine = vaultEngineAddress;
        pbt = tcnAddress;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////
    function deposit(uint256 amount) external {
        vaultEngine.addStablecoin(msg.sender, amount * 1e27);
        aurei.burn(msg.sender, amount);
        emit DepositAurei(msg.sender, amount);
    }

    function withdrawAurei(uint256 amount) external {
        vaultEngine.removeStablecoin(msg.sender, amount * 1e27);
        aurei.mint(msg.sender, amount);
        emit WithdrawAurei(msg.sender, amount);
    }

    function transferAurei(address recipient, uint256 amount) external {
        vaultEngine.moveStablecoin(msg.sender, recipient, amount * 1e27);
        emit TransferAurei(msg.sender, recipient, amount);
    }

    function withdrawTcn(uint256 amount) external {
        vaultEngine.removePbt(msg.sender, amount * 1e27);
        pbt.mint(msg.sender, amount);
        emit WithdrawTcn(msg.sender, amount);
    }
}
