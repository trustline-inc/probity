// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../Dependencies/Stateful.sol";
import "../Dependencies/Eventful.sol";
import "hardhat/console.sol";

// Shutdown Module's main purpose is to pause probity functionality and allow user to redeem AUR for the remaining
// collateral in the system
// Step 1. Pause all normal functionality
// Step 2. Set Final price of all collateral
// Step 3. free up collateral on Over Collateralized vaults, allow users to withdraw free Collateral (this is only available after final price has been set)
// Step 4. Allow Auctions to finish (is this gonna take too long?)
// Step 5. Calculate net +/- in reserve vs system debt
// Step 6. Calculate the net deficit in UnderCollateralized vaults (both debt side and supply side) (can we do this earlier?)
// Step 7. Calculate final Collateral per AUR = Collateral / Total AUR in Circulation
//

interface priceFeedLike {
  function getPrice(bytes32 collId) external returns (uint256 price);
}

interface vaultLike {
  function aur(address user) external returns (uint256 value);

  function unBackedAUR(address user) external returns (uint256 value);

  function totalDebt() external returns (uint256 value);

  function totalSupply() external returns (uint256 value);

  function moveAurei(
    address from,
    address to,
    uint256 amount
  ) external;

  function moveCollateral(
    bytes32 collId,
    address from,
    address to,
    uint256 amount
  ) external;

  function vaults(bytes32 collId, address user)
    external
    returns (
      uint256 freeColl,
      uint256 lockedColl,
      uint256 debt,
      uint256 supplied,
      uint256 lastSuppAccu
    );

  function collTypes(bytes32 collId)
    external
    returns (
      uint256 debtAccu,
      uint256 suppAccu,
      uint256 price,
      uint256 normDebt,
      uint256 normSupply,
      uint256 ceiling,
      uint256 floor
    );

  function modifyVault(
    bytes32 collId,
    address user,
    address auctioneer,
    address reservePool,
    int256 collAmount,
    int256 debt,
    int256 supply
  ) external;
}

interface reservePoolLike {}

contract Shutdown is Stateful, Eventful {
  /////////////////////////////////////////
  // Event
  /////////////////////////////////////////

  /////////////////////////////////////////
  // Modifier
  /////////////////////////////////////////

  modifier onlyWhenInShutdown() {
    require(
      initiated,
      "Shutdown/onlyWhenInShutdown: Shutdown has not been initiated"
    );
    _;
  }

  modifier onlyWhenNotInShutdown() {
    require(
      !initiated,
      "Shutdown/onlyWhenNotInShutdown: Shutdown has already been initiated"
    );
    _;
  }

  modifier onlyIfFinalPriceSet(bytes32 collId) {
    require(
      collTypes[collId].finalPrice != 0,
      "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this collId"
    );
    _;
  }

  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////

  struct Collateral {
    uint256 finalPrice;
    uint256 finalPriceRetrievalTime;
    uint256 gap;
    uint256 redeemRatio;
  }

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////

  uint256 constant RAY = 10**27;

  priceFeedLike priceFeed;
  vaultLike vault;
  reservePoolLike reservePool;

  bool public initiated;
  uint256 public initiatedAt;
  mapping(bytes32 => Collateral) public collTypes;
  mapping(bytes32 => mapping(address => uint256)) public collRedeemed;
  mapping(address => uint256) public aur;
  uint256 public finalAurUtilizationRatio;
  uint256 public redeemRatio;
  uint256 public aurGap; // value of under-collateralized vaults
  uint256 public supplierObligationRatio;
  uint256 public debt;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(
    address registryAddress,
    priceFeedLike priceFeedAddress,
    vaultLike vaultAddress,
    reservePoolLike reservePoolAddress
  ) Stateful(registryAddress) {
    priceFeed = priceFeedAddress;
    vault = vaultAddress;
    reservePool = reservePoolAddress;
  }

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  // once a shutdown has been initiated, you can no longer cancel it.
  function initiateShutdown() external onlyWhenNotInShutdown onlyBy("gov") {
    initiated = true;
    initiatedAt = block.timestamp;
    // @todo figure out time to wait until next steps
    // @todo step 1 : freeze all related contracts

    // set utilizationRatio
    uint256 totalDebt = vault.totalDebt();
    uint256 totalSupply = vault.totalSupply();
    // @todo what if totalDebt is greater than totalSupply, we need to cap it at 100%
    if (totalSupply == 0) {
      finalAurUtilizationRatio = 0;
    } else {
      finalAurUtilizationRatio = rdiv(totalDebt, totalSupply);
    }
  }

  // step 2: set final prices
  function setFinalPrice(bytes32 collId) external onlyWhenInShutdown {
    uint256 price = priceFeed.getPrice(collId);
    require(price != 0, "Shutdown/setFinalPrice: price retrieved is zero");

    // @todo allow for finalPrice replacement, if it has changed too much within X hours by Y percentage.
    collTypes[collId].finalPrice = price;
    collTypes[collId].finalPriceRetrievalTime = block.timestamp;
  }

  // process the vault: cancel all outstanding debt, collect the appropriate amount of collateral, free up extra collateral
  // suppliers's collateral should
  function processUserDebt(bytes32 collId, address user)
    external
    onlyIfFinalPriceSet(collId)
  {
    // do we need freeColl variable?
    (, uint256 lockedColl, uint256 userDebt, , ) = vault.vaults(collId, user);
    (uint256 debtAccu, , , , , , ) = vault.collTypes(collId);

    uint256 debtCollAmount =
      (userDebt * debtAccu) / collTypes[collId].finalPrice;
    uint256 amountToGrab = min(lockedColl, debtCollAmount);
    uint256 gap = debtCollAmount - amountToGrab;
    collTypes[collId].gap += gap;
    aurGap += gap * collTypes[collId].finalPrice;

    vault.modifyVault(
      collId,
      user,
      address(this),
      address(this),
      -int256(amountToGrab),
      -int256(userDebt),
      0
    );
  }

  function freeExcessCollateral(bytes32 collId, address user) external {
    (, uint256 lockedColl, uint256 userDebt, uint256 supplied, ) =
      vault.vaults(collId, user);
    require(
      userDebt == 0,
      "Shutdown/freeExcessCollateral: User needs to process debt first before calling this"
    );

    // how do we make it so this can be reused
    uint256 hookedAmount = (supplied * finalAurUtilizationRatio);
    uint256 hookedCollAmount = hookedAmount / collTypes[collId].finalPrice;
    require(
      lockedColl > hookedCollAmount,
      "Shutdown/freeExcessCollateral: No collateral to free"
    );
    uint256 amountToFree = lockedColl - hookedCollAmount;

    // i don't think this is right @todo fix this
    vault.modifyVault(
      collId,
      user,
      user,
      address(this),
      -int256(amountToFree),
      0,
      0
    );
  }

  function calculateSupplierObligation() external {
    // assumptions:
    //    - all under-collateralized vaults have been processed
    //    - all outstanding auctions are over

    //@todo how do i check auctions are over

    uint256 reserve = vault.aur(address(reservePool));
    uint256 systemDebt = vault.unBackedAUR(address(reservePool));
    uint256 totalSupply = vault.totalSupply();

    if (reserve < systemDebt) {
      // this should be a smaller percentage than the finalAurUtilizationRatio because it uses totalDebt instead of just the gap
      // if we want supply to obligated to system debt, move the next line after the addition statement
      supplierObligationRatio = rdiv(aurGap, totalSupply);

      // system in debt
      aurGap += systemDebt - reserve;
    } else {
      // system have surplus
      if (reserve - systemDebt >= aurGap) {
        aurGap = 0;
      } else {
        aurGap -= reserve - systemDebt;
        debt = reserve - systemDebt;
      }
      // this should be a smaller percentage than the finalAurUtilizationRatio because it uses totalDebt instead of just the gap
      supplierObligationRatio = rdiv(aurGap, totalSupply);
    }
  }

  function calculateRedeemRatio(bytes32 collId) external {
    // @todo what check should we do to make sure we are in proper step

    // basically figure out how many AUR are in circulation, and do redeemRatio = theoretical ratio - gap / AUR in circulation
    // theoretical ratio = debt[collId] / collTypes[collId].finalPrice
    (uint256 debtAccu, , , uint256 collDebt, , , ) = vault.collTypes(collId);
    uint256 availableColl =
      (collDebt * debtAccu) /
        collTypes[collId].finalPrice -
        collTypes[collId].gap;
    // totalDebt of vault (this should already have included the unBackedAUR debt) - (positive system reserve)
    uint256 reserve = vault.aur(address(reservePool));
    uint256 aurCirculation = vault.totalDebt() - reserve;
    collTypes[collId].redeemRatio = availableColl / aurCirculation;
  }

  // process supplier side to fill the aur Gap created by under collateralized vaults
  function processUserSupply(bytes32 collId, address user) external {
    require(
      supplierObligationRatio != 0,
      "Shutdown/processUserSupply:Supplier has no obligation"
    );

    (, uint256 lockedColl, , uint256 supplied, ) = vault.vaults(collId, user);

    uint256 suppObligatedAmount =
      (supplied * supplierObligationRatio) / collTypes[collId].finalPrice;
    uint256 amountToGrab = min(lockedColl, suppObligatedAmount);
    console.log(supplierObligationRatio);
    console.log(supplied);
    console.log(collTypes[collId].finalPrice);
    console.log(suppObligatedAmount);
    console.log(amountToGrab);
    collTypes[collId].gap -= amountToGrab;
    aurGap -= amountToGrab * collTypes[collId].finalPrice;

    vault.modifyVault(
      collId,
      user,
      address(this),
      address(this),
      -int256(amountToGrab),
      0,
      -int256(supplied)
    );
  }

  function returnAurei(uint256 amount) external {
    // user will return aurei to this contract allow user to withdraw the proportionate amount of collateral of all types
    vault.moveAurei(msg.sender, address(this), amount);
    aur[msg.sender] += amount;
  }

  function redeemCollateral(bytes32 collId) external {
    // can withdraw collateral returnedAurei * collateralPerAUR for collateral type
    // @todo double check redeemRatio and it's usage
    uint256 redeemAmount =
      (aur[msg.sender] / collTypes[collId].redeemRatio) -
        collRedeemed[collId][msg.sender];
    collRedeemed[collId][msg.sender] += redeemAmount;
    vault.moveCollateral(collId, address(this), msg.sender, redeemAmount);
  }

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  function min(uint256 a, uint256 b) internal pure returns (uint256 c) {
    if (a > b) {
      return b;
    } else {
      return a;
    }
  }

  function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
    z = ((x * RAY) + y / 2) / y;
  }
}
