// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./VaultEngineRestricted.sol";

/**
 * @title VaultEngineIssuer contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 * This contract inherits VaultEngineRestricted and adds a feature to manage issuance and redemptions.
 */

contract VaultEngineIssuer is VaultEngineRestricted {
    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) VaultEngineRestricted(registryAddress) {}

    /**
     * @notice Issues system currency to an account
     * @param account The holder of the issued system currency
     * @param amount The amount to issue
     */
    function modifySupply(address account, int256 amount) external virtual onlyBy("gov") {
        _modifySupply(account, amount);
    }

    function _modifySupply(address account, int256 amount) internal {
        systemCurrency[account] = Math._add(systemCurrency[account], amount);
        systemCurrencyIssued = Math._add(systemCurrencyIssued, amount);
        totalSystemDebt = Math._add(totalSystemDebt, amount);
        emit SupplyModified(msg.sender, account, amount);
    }
}
