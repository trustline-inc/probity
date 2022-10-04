// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function systemCurrency(address user) external returns (uint256);

    function systemDebt(address user) external returns (uint256);

    function settle(uint256 amount) external;

    function increaseSystemDebt(uint256 amount) external;

    function moveSystemCurrency(
        address from,
        address to,
        uint256 amount
    ) external;
}

interface BondIssuerLike {
    function newOffering(uint256 amount) external;
}

/**
 * @title ReservePool contract
 * @notice Reserve Pool act as the Probity system's balance sheet
 * Reserve Pool is Probity's balance sheet, all the system debt and protocol fees will be held by this contract.
 */
contract ReservePool is Stateful, Eventful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    VaultEngineLike public immutable vaultEngine;
    BondIssuerLike public immutable bondSeller;

    uint256 public debtOnAuction; // Debt currently on auction [RAD]
    uint256 public debtThreshold; // The bad debt threshold, after which to start issuing bonds [RAD]

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event DebtOnAuctionAdded(uint256 amountIncreased);
    event DebtOnAuctionRemoved(uint256 amountRemoved);
    event SystemDebtIncreased(uint256 amountToIncrase);
    event SystemDebtSettled(uint256 amountSettle);
    event SystemCurrencyTransferred(address to, uint256 amount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        BondIssuerLike bondSellerAdress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        bondSeller = bondSellerAdress;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @notice Updates the debt threshold required for a sale
     * @param newThreshold The new debt threshold
     */
    function updateDebtThreshold(uint256 newThreshold) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "debtThreshold", debtThreshold, newThreshold);
        debtThreshold = newThreshold;
    }

    /**
     * @notice Adds auction debt. Only callable by Liquidator.
     * @param newDebt The amount of debt to add
     */
    function addAuctionDebt(uint256 newDebt) external onlyBy("liquidator") {
        debtOnAuction += newDebt;
        emit DebtOnAuctionAdded(newDebt);
    }

    /**
     * @notice Reduces auction debt. Only callable by Liquidator.
     * @param debtToReduce The amount of debt to reduce
     */
    function reduceAuctionDebt(uint256 debtToReduce) external onlyBy("liquidator") {
        debtOnAuction -= debtToReduce;

        emit DebtOnAuctionRemoved(debtToReduce);
    }

    /**
     * @notice Settles bad debt
     * @param amountToSettle The amount of bad debt to settle
     */
    function settle(uint256 amountToSettle) external onlyByProbity {
        require(
            amountToSettle <= vaultEngine.systemDebt(address(this)),
            "ReservePool/settle: Settlement amount is more than the debt"
        );
        require(
            vaultEngine.systemCurrency(address(this)) >= amountToSettle,
            "ReservePool/settle: Not enough balance to settle"
        );

        vaultEngine.settle(amountToSettle);

        emit SystemDebtSettled(amountToSettle);
    }

    /**
     * @notice Increases system debt
     * @param amountToIncrease The amount of debt to settle
     */
    function increaseSystemDebt(uint256 amountToIncrease) external onlyByProbity {
        vaultEngine.increaseSystemDebt(amountToIncrease);

        emit SystemDebtIncreased(amountToIncrease);
    }

    /**
     * @notice Sends reserve pool systemCurrencys elsewhere
     * @param to The receiving address
     * @param amount The amount to send
     */
    function sendSystemCurrency(address to, uint256 amount) external onlyBy("gov") {
        vaultEngine.moveSystemCurrency(address(this), to, amount);

        emit SystemCurrencyTransferred(to, amount);
    }

    /**
     * @notice Starts a sale for future reserve pool profits
     */
    function startBondSale() external onlyByProbity {
        require(
            vaultEngine.systemDebt(address(this)) - debtOnAuction > debtThreshold,
            "ReservePool/startBondSale: Debt threshold is not yet crossed"
        );

        require(
            vaultEngine.systemCurrency(address(this)) == 0,
            "ReservePool/startBondSale: SystemCurrency balance is still positive"
        );

        bondSeller.newOffering(debtThreshold);
    }
}
