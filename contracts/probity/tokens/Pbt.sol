// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../dependencies/Stateful.sol";

/**
 * @title Probity token contract
 * @notice PBT ERC20 Token Contract a non transferable token
 */
contract PBT is ERC20, Stateful {
    constructor(address registryAddress) Stateful(registryAddress) ERC20("Trustline Credit Network Token", "PBT") {}

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
     * @dev disable approve function of Pbt token
     */
    function _approve(
        address,
        address,
        uint256
    ) internal pure override {
        revert("Approve is disabled for PBT token");
    }

    /**
     * @dev disable transfer of Pbt Token
     */
    function _transfer(
        address,
        address,
        uint256
    ) internal pure override {
        revert("Transfer is disabled for PBT token");
    }
}
