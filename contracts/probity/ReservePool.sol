// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

// reserve pool holds the extra aur that comes from liquidation penalty fee, protocol fees
// whenever the system have bad debt, this pool will be used to pay it off
// if there are no more reserve to pay off the outstanding bad debt, the reserve will sell IOUs in order to cover it
// people with IOU can redeem it after the reserve replenishes
interface VaultEngineLike {
  function aur(address user) external returns (uint256 balance);

  function unbackedAurei(address user) external returns (uint256 balance);

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
  VaultEngineLike public vaultEngine;
  IOUSale public sale;

  uint256 public debtThreshold; // the bad debt threshold, after which to start selling IOU
  uint256 public debtOnAuction;
  // every Y hours , IOU received per AUR goes up by X% @todo evaluate these values
  uint256 private constant ONE = 1E18;
  uint256 public salePriceIncreasePerStep = 5E16;
  uint256 public saleStepPeriod = 6 hours;
  // max IOU received per AUR is 50% @todo evaluate this max value
  uint256 public saleMaxPrice = 1.5E18;
  mapping(address => uint256) public ious;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(address registryAddress, VaultEngineLike vaultEngineAddress)
    Stateful(registryAddress)
  {
    vaultEngine = vaultEngineAddress;
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
      vaultEngine.unbackedAurei(address(this)) <= amountToSettle,
      "ReservePool/settle: Settlement amount is more than the debt"
    );
    require(
      vaultEngine.aur(address(this)) >= amountToSettle,
      "ReservePool/settle: Not enough balance to settle"
    );
    vaultEngine.settle(amountToSettle);
  }

  function startIOUSale() external {
    require(
      vaultEngine.unbackedAurei(address(this)) - debtOnAuction > debtThreshold,
      "ReservePool/startIOUSale: Debt Threshold is not yet crossed"
    );
    require(
      vaultEngine.aur(address(this)) == 0,
      "ReservePool/startIOUSale: AUR balance is still positive"
    );
    require(
      sale.active == false,
      "ReservePool/startIOUSale: the current sale is not over yet"
    );
    sale.active = true;
    sale.startTime = block.timestamp;
    sale.saleAmount = debtThreshold;
  }

  function buyIOU(uint256 amount) external {
    require(sale.active, "ReservePool/buyIOU: IOUs are not currently on sale");
    require(
      sale.saleAmount >= amount,
      "ReservePool/buyIOU: Can't buy more amount than what's available"
    );

    vaultEngine.moveAurei(msg.sender, address(this), amount);
    vaultEngine.settle(amount);
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
      vaultEngine.aur(address(this)) >= amount,
      "ReservePool/redeemIOU: The reserve pool doesn't have enough AUR"
    );
    require(
      ious[msg.sender] >= amount,
      "ReservePool/redeemIOU: User doesn't have enough IOU to redeem this much"
    );
    ious[msg.sender] = ious[msg.sender] - amount;
    vaultEngine.moveAurei(address(this), msg.sender, amount);
  }
}
