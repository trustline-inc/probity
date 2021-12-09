// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

// reserve pool holds the extra aur that comes from liquidation penalty fee, protocol fees
// whenever the system have bad debt, this pool will be used to pay it off
// if there are no more reserve to pay off the outstanding bad debt,
// the reserve will sell IOUs in order to cover it
// people with IOU can redeem it after the reserve replenishes
interface VaultEngineLike {
    function stablecoin(address user) external returns (uint256 balance);

    function unbackedStablecoin(address user) external returns (uint256 balance);

    function settle(uint256 balance) external;

    function increaseSystemDebt(uint256 amount) external;

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;
}

contract ReservePool is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct IOUSale {
        bool active;
        uint256 startTime;
        uint256 saleAmount;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1E18;
    VaultEngineLike public immutable vaultEngine;

    IOUSale public sale;
    uint256 public debtThreshold; // the bad debt threshold, after which to start selling IOU
    uint256 public debtOnAuction;
    // every Y hours , IOU received per AUR goes up by X% @todo evaluate these values
    uint256 public salePriceIncreasePerStep = 5E16;
    uint256 public saleStepPeriod = 6 hours;
    // max IOU received per AUR is 50% @todo evaluate this max value
    uint256 public saleMaxPrice = 1.5E18;
    mapping(address => uint256) public ious;
    uint256 public totalIous;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address registryAddress, VaultEngineLike vaultEngineAddress) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
    }

    /////////////////////////////////////////
    // Public functions
    /////////////////////////////////////////
    // step wise price increase until maxPrice
    function iouPerAur() public view returns (uint256 price) {
        uint256 steps = (block.timestamp - sale.startTime) / saleStepPeriod;

        if (ONE + (salePriceIncreasePerStep * steps) > saleMaxPrice) {
            return saleMaxPrice;
        } else {
            return ONE + (salePriceIncreasePerStep * steps);
        }
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////
    function updateSaleMaxPrice(uint256 newMaxPrice) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "saleMaxPrice", saleMaxPrice, newMaxPrice);
        saleMaxPrice = newMaxPrice;
    }

    function updateSaleStepPeriod(uint256 newStepPeriod) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "saleStepPeriod", saleStepPeriod, newStepPeriod);
        saleStepPeriod = newStepPeriod;
    }

    function updateSalePriceIncreasePerStep(uint256 newPriceIncreasePerStep) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "salePriceIncreasePerStep", salePriceIncreasePerStep, newPriceIncreasePerStep);
        salePriceIncreasePerStep = newPriceIncreasePerStep;
    }

    function updateDebtThreshold(uint256 newThreshold) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "debtThreshold", debtThreshold, newThreshold);
        debtThreshold = newThreshold;
    }

    function addAuctionDebt(uint256 newDebt) external onlyBy("liquidator") {
        debtOnAuction += newDebt;
    }

    function reduceAuctionDebt(uint256 debtToReduce) external onlyBy("liquidator") {
        debtOnAuction -= debtToReduce;
    }

    function settle(uint256 amountToSettle) external {
        require(
            amountToSettle <= vaultEngine.unbackedStablecoin(address(this)),
            "ReservePool/settle: Settlement amount is more than the debt"
        );
        require(
            vaultEngine.stablecoin(address(this)) >= amountToSettle,
            "ReservePool/settle: Not enough balance to settle"
        );
        vaultEngine.settle(amountToSettle);
    }

    function increaseSystemDebt(uint256 amountToSettle) external {
        vaultEngine.increaseSystemDebt(amountToSettle);
    }

    function startIouSale() external {
        require(
            vaultEngine.unbackedStablecoin(address(this)) - debtOnAuction > debtThreshold,
            "ReservePool/startIouSale: Debt Threshold is not yet crossed"
        );
        require(vaultEngine.stablecoin(address(this)) == 0, "ReservePool/startIouSale: AUR balance is still positive");
        require(sale.active == false, "ReservePool/startIouSale: the current sale is not over yet");
        sale.active = true;
        sale.startTime = block.timestamp;
        sale.saleAmount = debtThreshold;
    }

    function buyIou(uint256 amount) external {
        require(sale.active, "ReservePool/buyIou: ious are not currently on sale");
        require(sale.saleAmount >= amount, "ReservePool/buyIou: Can't buy more amount than what's available");

        vaultEngine.moveStablecoin(msg.sender, address(this), amount);
        vaultEngine.settle(amount);
        uint256 amountToBuy = ((amount * iouPerAur()) / ONE);
        ious[msg.sender] += amountToBuy;
        totalIous += amountToBuy;
        sale.saleAmount = sale.saleAmount - amount;
        if (sale.saleAmount == 0) {
            sale.active = false;
        }
    }

    function redeemIou(uint256 amount) external {
        processRedemption(msg.sender, amount);
    }

    function shutdownRedemption(address user, uint256 amount) external onlyWhen("shutdown", true) onlyBy("shutdown") {
        processRedemption(user, amount);
    }

    function sendStablecoin(address to, uint256 amount) external onlyBy("gov") {
        vaultEngine.moveStablecoin(address(this), to, amount);
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////

    function processRedemption(address user, uint256 amount) internal {
        require(
            vaultEngine.stablecoin(address(this)) >= amount,
            "ReservePool/processRedemption: The reserve pool doesn't have enough AUR"
        );
        require(
            ious[user] >= amount,
            "ReservePool/processRedemption: User doesn't have enough iou to redeem this much"
        );

        ious[user] -= amount;
        vaultEngine.moveStablecoin(address(this), user, amount);
    }
}
