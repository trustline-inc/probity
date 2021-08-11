// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../Dependencies/Stateful.sol";
import "../Dependencies/Eventful.sol";

// @todo this interface does come from flare team but may need to update after they launch FTSO
interface ftsoLike {
  function getCurrentPrice()
    external
    returns (uint256 _price, uint256 _timestamp);
}

contract Vault is Stateful, Eventful {
  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////

  struct Collateral {
    uint256 debtAccu; // Debt Accumulator
    uint256 suppAccu; // Supplier Accumulator
    uint256 price; // price adjusted for collateral Ratio
    uint256 normDebt; // normalized Debt
    uint256 normSupply; // normalized Supply
    uint256 ceiling; // max amount that can be supplied/debt
    uint256 floor; // min amount of that must be supplied/debt
  }

  struct UserVault {
    uint256 freeColl; // Collateral that is free to move around
    uint256 lockedColl; // Collateral that is locked as collateral
    uint256 debt;
    uint256 supplied;
  }

  /////////////////////////////////////////
  // Data Variables
  /////////////////////////////////////////

  mapping(bytes32 => Collateral) public collTypes;
  mapping(bytes32 => mapping(address => UserVault)) public vaults;
  mapping(address => uint256) public aur;
  mapping(address => uint256) public unBackedAUR;

  uint256 public totalDebt;
  uint256 public totalSupply;
  uint256 public totalUnCollDebt;

  uint256 constant PRECISION_PRICE = 10**27;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(address registryAddress) Stateful(registryAddress) {}

  /////////////////////////////////////////
  // Public functions
  /////////////////////////////////////////

  function modifyCollateral(
    bytes32 collateral,
    address user,
    int256 amount
  ) external onlyByRegistered {
    vaults[collateral][user].freeColl = add(
      vaults[collateral][user].freeColl,
      amount
    );
  }

  function moveCollateral(
    bytes32 collateral,
    address from,
    address to,
    uint256 amount
  ) external onlyByRegistered {
    vaults[collateral][from].freeColl -= amount;
    vaults[collateral][to].freeColl += amount;
  }

  function moveAurei(
    address from,
    address to,
    uint256 amount
  ) external onlyByRegistered {
    aur[from] -= amount;
    aur[to] += amount;
  }

  function reduceInterest(address user, uint256 amount)
    external
    onlyByRegistered
  {
    interests[user] -= amount;
  }

  function convertInterestToAurei(address user, uint256 amount)
    external
    onlyByRegistered
  {
    interests[user] -= amount;
    aur[user] += amount;
  }

  function collectInterest(bytes32 collId, bool isTcn) public {
    UserVault memory vault = vaults[collId][msg.sender];
    Collateral memory collateral = collTypes[collId];
    if (isTcn) {
      interests[msg.sender] +=
        vault.supplied *
        (collateral.suppAccu - vault.lastSuppAccu);
    } else {
      aur[msg.sender] +=
        vault.supplied *
        (collateral.suppAccu - vault.lastSuppAccu);
    }

    vaults[collId][msg.sender].lastSuppAccu = collateral.suppAccu;
  }

  function modifySupply(
    bytes32 collId,
    address treasuryAddress,
    int256 collAmount,
    int256 supplyAmount
  ) external {
    require(
      registry.checkIfValidContract("treasury", treasuryAddress),
      "VAULT: Treasury address is not valid"
    );

    collectInterest(collId, true);

    UserVault storage vault = vaults[collId][msg.sender];
    vault.freeColl = sub(vault.freeColl, collAmount);
    vault.lockedColl = add(vault.lockedColl, collAmount);
    vault.supplied = add(vault.supplied, supplyAmount);

    collTypes[collId].normSupply = add(
      collTypes[collId].normSupply,
      supplyAmount
    );

    int256 aurToModify = mul(collTypes[collId].suppAccu, supplyAmount);
    totalSupply = add(totalSupply, aurToModify);

    require(
      totalSupply <= collTypes[collId].ceiling,
      "VAULT: Supply ceiling reached"
    );
    require(
      vault.supplied == 0 || vault.supplied > collTypes[collId].floor,
      "VAULT: SUPPLIED SMALLER THAN SMALLEST AMOUNT"
    );
    checkMinRatioMaintained(collId, vault);

    aur[treasuryAddress] = add(aur[treasuryAddress], aurToModify);

    emit Log("vault", "modifySupply", msg.sender);
  }

  function modifyDebt(
    bytes32 collId,
    address treasuryAddress,
    int256 collAmount,
    int256 debtAmount
  ) external {
    require(
      registry.checkIfValidContract("treasury", treasuryAddress),
      "VAULT: Treasury address is not valid"
    );
    require(
      aur[treasuryAddress] >= uint256(debtAmount),
      "Treasury doesn't have enough supply to loan this amount"
    );

    UserVault memory vault = vaults[collId][msg.sender];
    vault.freeColl = sub(vault.freeColl, collAmount);
    vault.lockedColl = add(vault.lockedColl, collAmount);
    vault.debt = add(vault.debt, debtAmount);

    collTypes[collId].normDebt = add(collTypes[collId].normDebt, debtAmount);

    int256 debtToModify = mul(collTypes[collId].debtAccu, debtAmount);
    totalDebt = add(totalDebt, debtToModify);

    require(
      totalDebt <= collTypes[collId].ceiling,
      "VAULT: Debt ceiling reached"
    );
    require(
      vault.debt == 0 || vault.debt > collTypes[collId].floor,
      "VAULT: Debt Smaller than floor"
    );
    checkMinRatioMaintained(collId, vault);

    aur[msg.sender] = add(aur[msg.sender], debtToModify);
    aur[treasuryAddress] = sub(aur[treasuryAddress], debtToModify);

    vaults[collId][msg.sender] = vault;

    emit Log("vault", "modifyDebt", msg.sender);
  }

  function liquidateVault(
    bytes32 collId,
    address user,
    address auctioneer,
    address reservePool,
    int256 collateralAmount,
    int256 debtAmount,
    int256 suppAmount
  ) external onlyBy("liquidator") {
    UserVault storage vault = vaults[collId][user];
    Collateral storage coll = collTypes[collId];

    vault.lockedColl = add(vault.lockedColl, collateralAmount);
    vault.debt = add(vault.debt, debtAmount);
    vault.supplied = add(vault.supplied, suppAmount);
    coll.normDebt = add(coll.normDebt, debtAmount);
    coll.normSupply = add(coll.normSupply, suppAmount);

    int256 aurToRaise =
      mul(coll.debtAccu, debtAmount) + mul(PRECISION_PRICE, suppAmount);

    vaults[collId][auctioneer].freeColl = sub(
      vaults[collId][auctioneer].freeColl,
      collateralAmount
    );
    unBackedAUR[reservePool] = sub(unBackedAUR[reservePool], aurToRaise);
    totalUnCollDebt = sub(totalUnCollDebt, aurToRaise);

    emit Log("vault", "liquidateVault", msg.sender);
  }

  // @todo do we also need to add a way to increase unCollDebt?
  function settle(uint256 amount) external onlyByRegistered {
    aur[msg.sender] = aur[msg.sender] - amount;
    unBackedAUR[msg.sender] = unBackedAUR[msg.sender] - amount;

    emit Log("vault", "settle", msg.sender);
  }

  // Admin related functions
  function initCollType(bytes32 collId) external {
    collTypes[collId].debtAccu = PRECISION_PRICE;
    collTypes[collId].suppAccu = PRECISION_PRICE;
  }

  function updateCeiling(bytes32 collId, uint256 ceiling)
    external
    onlyBy("gov")
  {
    emit LogVarUpdate(
      "Vault",
      collId,
      "ceiling",
      collTypes[collId].ceiling,
      ceiling
    );
    collTypes[collId].ceiling = ceiling;
  }

  function updateFloor(bytes32 collId, uint256 floor) external onlyBy("gov") {
    emit LogVarUpdate("Vault", collId, "floor", collTypes[collId].floor, floor);
    collTypes[collId].floor = floor;
  }

  function updateAccumulators(
    bytes32 collId,
    uint256 debtAccu,
    uint256 supplierAccu
  ) external onlyBy("teller") {
    emit LogVarUpdate(
      "Vault",
      collId,
      "debtAccu",
      collTypes[collId].debtAccu,
      debtAccu
    );
    emit LogVarUpdate(
      "Vault",
      collId,
      "suppAccu",
      collTypes[collId].suppAccu,
      supplierAccu
    );

    collTypes[collId].debtAccu = debtAccu;
    collTypes[collId].suppAccu = supplierAccu;
  }

  function updatePrice(bytes32 collId, uint256 price)
    external
    onlyByRegistered
  {
    emit LogVarUpdate("Vault", collId, "price", collTypes[collId].price, price);
    collTypes[collId].price = price;
  }

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  function checkMinRatioMaintained(bytes32 collId, UserVault memory vault)
    internal
    view
  {
    require(
      (vault.debt * collTypes[collId].debtAccu) +
        (vault.supplied * PRECISION_PRICE) <=
        vault.lockedColl * collTypes[collId].price,
      "VAULT: Not enough collateral"
    );
  }

  function sub(uint256 a, int256 b) internal pure returns (uint256 c) {
    unchecked {
      c = a - uint256(b);
    }
    require(b <= 0 || c <= a, "Vault: sub op failed");
    require(b >= 0 || c >= a, "Vault: sub op failed");
  }

  function add(uint256 a, int256 b) internal pure returns (uint256 c) {
    unchecked {
      c = a + uint256(b);
    }
    require(b >= 0 || c <= a, "Vault: add op failed");
    require(b <= 0 || c >= a, "Vault: add op failed");
  }

  function mul(uint256 a, int256 b) internal pure returns (int256 c) {
    c = int256(a) * b;
    require(int256(a) >= 0);
    require(b == 0 || c / b == int256(a));
  }
}
