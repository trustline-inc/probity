// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function stablecoin(address user) external returns (uint256 balance);

    function unbackedDebt(address user) external returns (uint256 balance);

    function settle(uint256 balance) external;

    function increaseSystemDebt(uint256 amount) external;

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;
}

interface BondsLike {
    function newOffering(uint256 amount) external;
}

// The reserve pool holds the extra stablecoins that come from liquidation penalty fees
// and protocol fees. When the system has bad debt, this reserve pool will be used to pay
// it off. If there are no more reserves to pay off the outstanding bad debt, the reserve
// will issue vouchers in order to cover it. People with IOUs can redeem it after the reserve
// replenishes.
contract ReservePool is Stateful, Eventful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1E18;
    VaultEngineLike public immutable vaultEngine;
    BondsLike public immutable bondSeller;

    uint256 public debtOnAuction;
    uint256 public debtThreshold; // The bad debt threshold, after which to start issuing vouchers

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        BondsLike bondSellerAdress
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
    }

    /**
     * @notice Reduces auction debt. Only callable by Liquidator.
     * @param debtToReduce The amount of debt to reduce
     */
    function reduceAuctionDebt(uint256 debtToReduce) external onlyBy("liquidator") {
        debtOnAuction -= debtToReduce;
    }

    /**
     * @notice Settles bad debt
     * @param amountToSettle The amount of bad debt to settle
     */
    function settle(uint256 amountToSettle) external onlyByProbity {
        require(
            amountToSettle <= vaultEngine.unbackedDebt(address(this)),
            "ReservePool/settle: Settlement amount is more than the debt"
        );
        require(
            vaultEngine.stablecoin(address(this)) >= amountToSettle,
            "ReservePool/settle: Not enough balance to settle"
        );
        vaultEngine.settle(amountToSettle);
    }

    /**
     * @notice Increases system debt
     * @param amountToSettle The amount of debt to settle
     */
    function increaseSystemDebt(uint256 amountToSettle) external onlyByProbity {
        vaultEngine.increaseSystemDebt(amountToSettle);
    }

    /**
     * @notice Sends reserve pool stablecoins elsewhere
     * @param to The receiving address
     * @param amount The amount to send
     */
    function sendStablecoin(address to, uint256 amount) external onlyBy("gov") {
        vaultEngine.moveStablecoin(address(this), to, amount);
    }

    /**
     * @notice Starts a sale for future reserve pool profits
     */
    function startSale() external onlyByProbity {
        require(
            vaultEngine.unbackedDebt(address(this)) - debtOnAuction > debtThreshold,
            "ReservePool/startSale: Debt threshold is not yet crossed"
        );
        require(
            vaultEngine.stablecoin(address(this)) == 0,
            "ReservePool/startSale: Stablecoin balance is still positive"
        );

        bondSeller.newOffering(debtThreshold);
    }
}
