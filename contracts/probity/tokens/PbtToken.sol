// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../dependencies/Stateful.sol";

/**
 * Based upon OpenZeppelin's ERC20 contract:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
 *
 * and their EIP2612 (ERC20Permit / ERC712) functionality:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/53516bc555a454862470e7860a9b5254db4d00f5/contracts/token/ERC20/ERC20Permit.sol
 */
contract PbtToken is ERC20, Stateful {
    constructor(address registryAddress) Stateful(registryAddress) ERC20("Trustline Credit Network Token", "PBT") {}

    function mint(address account, uint256 amount) external onlyBy("treasury") {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyBy("treasury") {
        _burn(account, amount);
    }

    function _approve(
        address,
        address,
        uint256
    ) internal pure override {
        revert("Approve is disabled for PBT token");
    }

    function _transfer(
        address,
        address,
        uint256
    ) internal pure override {
        revert("Transfer is disabled for PBT token");
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override onlyWhen("paused", false) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
