// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

// reserve pool holds the extra aur that comes from liquidation penalty fee, protocol fees
// whenever the system have bad debt, this pool will be used to pay it off
// if there are no more reserve to pay off the outstanding bad debt, the reserve will sell IOUs in order to cover it
// people with IOU can redeem it after the reserve replenishes
interface VaultLike {
  function AUR(address user) external returns (uint256 balance);

  function impairedAurei(address user) external returns (uint256 balance);

  function settle(uint256 balance) external;

  function moveAurei(
    address from,
    address to,
    uint256 amount
  ) external;
}

contract ReservePool is Stateful, Eventful {
  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////
  struct IOUSale {
    bool active;
    uint256 startTime;
    uint256 saleAmount;
  }

  /////////////////////////////////////////
  // Data Variables
  /////////////////////////////////////////
  VaultLike vault;
  IOUSale public sale;

  uint256 public debtThreshold; // the bad debt threshold, after which to start selling IOU
  uint256 public debtOnAuction;
  // every Y hours , IOU received per AUR goes up by X% @todo evaluate these values
  uint256 ONE = 1E18;
  uint256 salePriceIncreasePerStep = 5E16;
  uint256 saleStepPeriod = 6 hours;
  // max IOU received per AUR is 50% @todo evaluate this max value
  uint256 saleMaxPrice = 1.5E18;
  mapping(address => uint256) public ious;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(address registryAddress, VaultLike vaultAddress)
    Stateful(registryAddress)
  {
    vault = vaultAddress;
  }

  /////////////////////////////////////////
  // External functions
  /////////////////////////////////////////

  function updateSaleMaxPrice(uint256 newMaxPrice) external onlyBy("gov") {
    emit LogVarUpdate("reserve", "saleMaxPrice", saleMaxPrice, newMaxPrice);
    saleMaxPrice = newMaxPrice;
  }

  function updateSaleStepPeriod(uint256 newStepPeriod) external onlyBy("gov") {
    emit LogVarUpdate(
      "reserve",
      "saleStepPeriod",
      saleStepPeriod,
      newStepPeriod
    );
    saleStepPeriod = newStepPeriod;
  }

  function updateSalePriceIncreasePerStep(uint256 newPriceIncreasePerStep)
    external
    onlyBy("gov")
  {
    emit LogVarUpdate(
      "reserve",
      "salePriceIncreasePerStep",
      salePriceIncreasePerStep,
      newPriceIncreasePerStep
    );
    salePriceIncreasePerStep = newPriceIncreasePerStep;
  }

  function updateDebtThreshold(uint256 newThreshold) external onlyBy("gov") {
    emit LogVarUpdate("reserve", "debtThreshold", debtThreshold, newThreshold);
    debtThreshold = newThreshold;
  }

  function addAuctionDebt(uint256 newDebt) external onlyBy("liquidator") {
    debtOnAuction = debtOnAuction + newDebt;
  }

  function settle(uint256 amountToSettle) external {
    require(
      vault.impairedAurei(address(this)) <= amountToSettle,
      "Settlement amount is more than the debt"
    );
    require(
      vault.AUR(address(this)) >= amountToSettle,
      "Not enough balance to settle"
    );
    vault.settle(amountToSettle);
  }

  function startIOUSale() external {
    require(
      vault.impairedAurei(address(this)) - debtOnAuction > debtThreshold,
      "Debt Threshold is not yet crossed"
    );
    require(vault.AUR(address(this)) == 0, "AUR balance is still positive");
    require(sale.active == false, "the current sale is not over yet");
    sale.active = true;
    sale.startTime = block.timestamp;
    sale.saleAmount = debtThreshold;
  }

  function buyIOU(uint256 amount) external {
    require(sale.active, "There are no IOU on sale");
    require(
      sale.saleAmount >= amount,
      "Can't buy more amount than what's available"
    );

    vault.moveAurei(msg.sender, address(this), amount);
    vault.settle(amount);
    ious[msg.sender] = ious[msg.sender] + ((amount * iouPerAur()) / ONE);
    sale.saleAmount = sale.saleAmount - amount;
    if (sale.saleAmount == 0) {
      sale.active = false;
    }
  }

  // step wise price increase until maxPrice
  function iouPerAur() public view returns (uint256 price) {
    uint256 steps = (block.timestamp - sale.startTime) / saleStepPeriod;

    if (ONE + (salePriceIncreasePerStep * steps) > saleMaxPrice) {
      return saleMaxPrice;
    } else {
      return ONE + (salePriceIncreasePerStep * steps);
    }
  }

  function redeemIOU(uint256 amount) external {
    require(
      vault.AUR(address(this)) >= amount,
      "The reserve pool doesn't have enough AUR"
    );
    require(
      ious[msg.sender] >= amount,
      "User doesn't have enough IOU to redeem this much"
    );
    ious[msg.sender] = ious[msg.sender] - amount;
    vault.moveAurei(address(this), msg.sender, amount);
  }
}
