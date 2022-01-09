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

// The reserve pool holds the extra stablecoins that come from liquidation penalty fees
// and protocol fees. When the system has bad debt, this reserve pool will be used to pay
// it off. If there are no more reserves to pay off the outstanding bad debt, the reserve
// will issue vouchers in order to cover it. People with IOUs can redeem it after the reserve
// replenishes.
contract ReservePool is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Offering {
        bool active;
        uint256 startTime;
        uint256 amount;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1E18;
    VaultEngineLike public immutable vaultEngine;

    Offering public offering;
    uint256 public debtThreshold; // The bad debt threshold, after which to start issuing vouchers
    uint256 public debtOnAuction;
    // Every Y hours, vouchers received per stablecoin goes up by X%
    // TODO: evaluate these values
    uint256 public salePriceIncreasePerStep = 5E16;
    uint256 public saleStepPeriod = 6 hours;
    // Max vouchers received per stablecoin is 50%
    // TODO: evaluate this max value
    uint256 public saleMaxPrice = 1.5E18;
    mapping(address => uint256) public vouchers;
    uint256 public totalVouchers;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address registryAddress, VaultEngineLike vaultEngineAddress) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
    }

    /////////////////////////////////////////
    // Public functions
    /////////////////////////////////////////

    /**
     * @notice Returns the amount of vouchers received per stablecoin
     * @dev Stepwise price increases until max price is met
     */
    function vouchersPerStablecoin() public view returns (uint256 price) {
        uint256 steps = (block.timestamp - offering.startTime) / saleStepPeriod;

        if (ONE + (salePriceIncreasePerStep * steps) > saleMaxPrice) {
            return saleMaxPrice;
        } else {
            return ONE + (salePriceIncreasePerStep * steps);
        }
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @notice Updates the maximum price for a sale
     * @param newMaxPrice The maximum price to set
     */
    function updateSaleMaxPrice(uint256 newMaxPrice) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "saleMaxPrice", saleMaxPrice, newMaxPrice);
        saleMaxPrice = newMaxPrice;
    }

    /**
     * @notice Updates the sale step period
     * @param newStepPeriod The new period of time per step
     */
    function updateSaleStepPeriod(uint256 newStepPeriod) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "saleStepPeriod", saleStepPeriod, newStepPeriod);
        saleStepPeriod = newStepPeriod;
    }

    /**
     * @notice Updates the sale price increase per step
     * @param newPriceIncreasePerStep The new price increase per step
     */
    function updateSalePriceIncreasePerStep(uint256 newPriceIncreasePerStep) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "salePriceIncreasePerStep", salePriceIncreasePerStep, newPriceIncreasePerStep);
        salePriceIncreasePerStep = newPriceIncreasePerStep;
    }

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
    function settle(uint256 amountToSettle) external {
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
    function increaseSystemDebt(uint256 amountToSettle) external {
        vaultEngine.increaseSystemDebt(amountToSettle);
    }

    /**
     * @notice Starts a sale for future reserve pool profits
     */
    function startSale() external {
        require(
            vaultEngine.unbackedDebt(address(this)) - debtOnAuction > debtThreshold,
            "ReservePool/startSale: Debt threshold is not yet crossed"
        );
        require(
            vaultEngine.stablecoin(address(this)) == 0,
            "ReservePool/startSale: Stablecoin balance is still positive"
        );
        require(offering.active == false, "ReservePool/startSale: the current offering is not over yet");
        offering.active = true;
        offering.startTime = block.timestamp;
        offering.amount = debtThreshold;
    }

    /**
     * @notice Purchases vouchers of an offering
     * @param amount The amount to be purchased
     */
    function purchaseVouchers(uint256 amount) external {
        require(offering.active, "ReservePool/purchaseVouchers: vouchers are not currently on sale");
        require(
            offering.amount >= amount,
            "ReservePool/purchaseVouchers: Can't purchase more vouchers than amount available"
        );

        vaultEngine.moveStablecoin(msg.sender, address(this), amount);
        vaultEngine.settle(amount);
        uint256 amountToBuy = ((amount * vouchersPerStablecoin()) / ONE);
        vouchers[msg.sender] += amountToBuy;
        totalVouchers += amountToBuy;
        offering.amount = offering.amount - amount;
        if (offering.amount == 0) {
            offering.active = false;
        }
    }

    /**
     * @notice Redeems vouchers for assets
     * @param amount The amount to redeem
     */
    function redeemVouchers(uint256 amount) external {
        processRedemption(msg.sender, amount);
    }

    /**
     * @notice Processes a redemption when the system is shut down
     * @param user The user to process for
     * @param amount The amount to redeem
     */
    function shutdownRedemption(address user, uint256 amount) external onlyWhen("shutdown", true) onlyBy("shutdown") {
        processRedemption(user, amount);
    }

    /**
     * @notice Sends reserve pool stablecoins elsewhere
     * @param to The receiving address
     * @param amount The amount to send
     */
    function sendStablecoin(address to, uint256 amount) external onlyBy("gov") {
        vaultEngine.moveStablecoin(address(this), to, amount);
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////

    /**
     * @notice Processes a redemption
     * @param user The user to process a redemption for
     * @param amount The amount to redeem
     */
    function processRedemption(address user, uint256 amount) internal {
        require(
            vaultEngine.stablecoin(address(this)) >= amount,
            "ReservePool/processRedemption: The reserve pool doesn't have enough funds"
        );
        require(
            vouchers[user] >= amount,
            "ReservePool/processRedemption: User doesn't have enough vouchers to redeem this amount"
        );

        vouchers[user] -= amount;
        vaultEngine.moveStablecoin(address(this), user, amount);
    }
}
