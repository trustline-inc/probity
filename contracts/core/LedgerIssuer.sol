// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.4;

import "./LedgerRestricted.sol";

/**
 * @title LedgerIssuer contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 * This contract inherits LedgerRestricted and adds a feature to manage issuance and redemptions.
 */

contract LedgerIssuer is LedgerRestricted {
    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) LedgerRestricted(registryAddress) {}

    /**
     * @notice Issues system currency to an account
     * @param account The holder of the issued system currency
     * @param amount The amount to issue
     */
    function modifySupply(address account, int256 amount) external virtual onlyBy("admin") {
        _modifySupply(account, amount);
    }

    function _modifySupply(address account, int256 amount) internal {
        systemCurrency[account] = Math._add(systemCurrency[account], amount);
        systemCurrencyIssued = Math._add(systemCurrencyIssued, amount);
        totalSystemDebt = Math._add(totalSystemDebt, amount);
        totalSystemCurrency = Math._add(totalSystemCurrency, amount);
        emit SupplyModified(msg.sender, account, amount);
    }
}
