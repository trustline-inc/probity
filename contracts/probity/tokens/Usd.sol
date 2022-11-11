// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../dependencies/Stateful.sol";

/**
 * @title USD token contract
 * @notice USD ERC20 Token Contract
 */
contract USD is ERC20, Stateful {
    constructor(address registryAddress) Stateful(registryAddress) ERC20("USD", "USD") {}

    /**
     * @dev TODO: may change decimals to 2 (commonly understood) or 6 (similar to USDC)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    /**
     * @dev minting capability for Treasury module
     * @param account the address to mint tokens for
     * @param amount of tokens to mint
     */
    function mint(address account, uint256 amount) external onlyBy("treasury") {
        _mint(account, amount);
    }

    /**
     * @dev burning capability for Treasury module
     * @param account the address to burn tokens for
     * @param amount of tokens to burn
     */
    function burn(address account, uint256 amount) external onlyBy("treasury") {
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
