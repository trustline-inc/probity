// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./VaultEngine.sol";

/**
 * @title VaultEngineUnrestricted contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 * This contract inherits VaultEngine removes the whitelist feature
 */

contract VaultEngineUnrestricted is VaultEngine {
    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) VaultEngine(registryAddress) {}

    function modifyEquity(
        bytes32 assetId,
        address treasuryAddress,
        int256 underlyingAmount,
        int256 equityAmount
    ) external override {
        require(
            registry.checkValidity("treasury", treasuryAddress),
            "Vault/modifyEquity: Treasury address is not valid"
        );

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        Vault storage vault = vaults[assetId][msg.sender];
        vault.standby = sub(vault.standby, underlyingAmount);
        vault.underlying = add(vault.underlying, underlyingAmount);
        int256 equityCreated = mul(assets[assetId].equityAccumulator, equityAmount);
        vault.equity = add(vault.equity, equityAmount);
        vault.initialEquity = add(vault.initialEquity, equityCreated);

        assets[assetId].normEquity = add(assets[assetId].normEquity, equityAmount);

        totalEquity = add(totalEquity, equityCreated);

        require(totalEquity <= assets[assetId].ceiling, "Vault/modifyEquity: Supply ceiling reached");
        require(
            vault.equity == 0 || (vault.equity * RAY) > assets[assetId].floor,
            "Vault/modifyEquity: Equity smaller than floor"
        );
        certifyEquityPosition(assetId, vault);

        stablecoin[treasuryAddress] = add(stablecoin[treasuryAddress], equityCreated);

        emit EquityModified(msg.sender, underlyingAmount, equityCreated);
    }

    /**
     * @notice Modifies vault debt
     * @param assetId The ID of the vault asset type
     * @param treasuryAddress The address of the desired treasury contract
     * @param collAmount Amount of asset supplied as loan security
     * @param debtAmount Amount of stablecoin to borrow
     */
    function modifyDebt(
        bytes32 assetId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) external override {
        require(registry.checkValidity("treasury", treasuryAddress), "Vault/modifyDebt: Treasury address is not valid");

        if (!vaultExists[msg.sender]) {
            vaultList.push(msg.sender);
            vaultExists[msg.sender] = true;
        }

        if (debtAmount > 0) {
            require(
                stablecoin[treasuryAddress] >= uint256(debtAmount),
                "Vault/modifyDebt: Treasury doesn't have enough equity to loan this amount"
            );
        }

        Vault memory vault = vaults[assetId][msg.sender];
        vault.standby = sub(vault.standby, collAmount);
        vault.collateral = add(vault.collateral, collAmount);
        int256 debtCreated = mul(assets[assetId].debtAccumulator, debtAmount);
        vault.debt = add(vault.debt, debtAmount);

        assets[assetId].normDebt = add(assets[assetId].normDebt, debtAmount);

        totalDebt = add(totalDebt, debtCreated);

        require(totalDebt <= assets[assetId].ceiling, "Vault/modifyDebt: Debt ceiling reached");
        require(
            vault.debt == 0 || (vault.debt * RAY) > assets[assetId].floor,
            "Vault/modifyDebt: Debt smaller than floor"
        );
        certifyDebtPosition(assetId, vault);

        stablecoin[msg.sender] = add(stablecoin[msg.sender], debtCreated);
        stablecoin[treasuryAddress] = sub(stablecoin[treasuryAddress], debtCreated);

        vaults[assetId][msg.sender] = vault;

        emit DebtModified(msg.sender, collAmount, debtCreated);
    }
}
