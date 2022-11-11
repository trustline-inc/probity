// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../dependencies/Stateful.sol";

/**
 * @title LQO token contract
 * @notice LQO ERC20 Token Contract
 */
contract LQO is ERC20, Stateful {
    constructor(address registryAddress) Stateful(registryAddress) ERC20("LQO", "LQO") {}

    /**
     * @dev fractional unit subscriptions are not currently allowed
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /**
     * @dev minting capability for gov
     * @param account the address to mint tokens for
     * @param amount of tokens to mint
     */
    function mint(address account, uint256 amount) external onlyBy("gov") {
        _mint(account, amount);
    }

    /**
     * @dev burning capability for gov
     * @param account the address to burn tokens for
     * @param amount of tokens to burn
     */
    function burn(address account, uint256 amount) external onlyBy("gov") {
        _burn(account, amount);
    }

    /**
     * @dev check if contract is in paused state before transferring
     * @param from the address to transfer tokens for
     * @param to the address to transfer tokens to
     * @param amount of tokens to transfer
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override onlyWhen("paused", false) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
