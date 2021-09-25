// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface ftsoLike {
  function getCurrentPrice()
    external
    returns (uint256 _price, uint256 _timestamp);
}

/**
 * @title VaultEngine contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 */
contract VaultEngine is Stateful, Eventful {
  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////

  // Vault data structure
  struct Vault {
    uint256 freeCollateral; // Collateral that is currently free
    uint256 lockedCollateral; // Collateral that is being utilized
    uint256 debt; // Vault's debt balance
    uint256 capital; // Vault's capital balance
    uint256 lastYieldIndex; // Most recent value of the capital rate accumulator
  }

  // Collateral data structure
  struct Collateral {
    uint256 interestIndex; // Cumulative interest index
    uint256 yieldIndex; // Cumulative yield index
    uint256 price; // Price adjusted for collateral ratio
    uint256 normDebt; // Normalized debt
    uint256 normCapital; // Normalized supply
    uint256 ceiling; // Max. amount that can be supplied/borrowed
    uint256 floor; // Min. amount of that must be supplied/borrowed
  }

  /////////////////////////////////////////
  // Data Variables
  /////////////////////////////////////////

  mapping(address => uint256) public AUR;
  mapping(address => uint256) public TCN;
  mapping(address => uint256) public unbackedAurei;
  mapping(bytes32 => Collateral) public collateralOptions;
  mapping(bytes32 => mapping(address => Vault)) public vaults;

  uint256 public totalDebt;
  uint256 public totalCapital;
  uint256 public totalunbackedAurei;

  uint256 constant PRECISION_PRICE = 10**27;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(address registryAddress) Stateful(registryAddress) {}

  /////////////////////////////////////////
  // Public functions
  /////////////////////////////////////////

  /**
   * @dev Modifies a vault's collateral.
   * @param collateral The collateral ID
   * @param user The address of the vault owner
   * @param amount The amount of collateral to modify
   */
  function modifyCollateral(
    bytes32 collateral,
    address user,
    int256 amount
  ) external onlyByRegistered {
    vaults[collateral][user].freeCollateral = add(
      vaults[collateral][user].freeCollateral,
      amount
    );
  }

  /**
   * @dev Moves collateral between vaults.
   * @param collateral The collateral ID
   * @param from The address of the originating vault owner
   * @param to The address of the beneficiary vault owner
   * @param amount The amount of collateral to move
   */
  function moveCollateral(
    bytes32 collateral,
    address from,
    address to,
    uint256 amount
  ) external onlyByRegistered {
    vaults[collateral][from].freeCollateral -= amount;
    vaults[collateral][to].freeCollateral += amount;
  }

  /**
   * @dev Moves Aurei between vaults.
   * @param from The address of the originating vault owner
   * @param to The address of the beneficiary vault owner
   * @param amount The amount of Aurei to move
   */
  function moveAurei(
    address from,
    address to,
    uint256 amount
  ) external onlyByRegistered {
    AUR[from] -= amount;
    AUR[to] += amount;
  }

  /**
   * @dev Reduce a user's interest balance.
   * @param user The address of the vault to reduce interest from.
   * @param amount The amount of TCN to reduce.
   */
  function reduceTCN(address user, uint256 amount) external onlyByRegistered {
    TCN[user] -= amount;
  }

  /**
   * @dev Converts TCN to Aurei
   * @param user The address of the vault for TCN conversion
   * @param amount The amount of TCN to convert
   * TODO: This is not being called anywhere. Do we need it?
   */
  function convertTcnToAurei(address user, uint256 amount)
    external
    onlyByRegistered
  {
    TCN[user] -= amount;
    AUR[user] += amount;
  }

  /**
   * @dev Accrues vault interest
   * @param collId The ID of the vault collateral type
   */
  function collectInterest(bytes32 collId) public {
    Vault memory vault = vaults[collId][msg.sender];
    Collateral memory collateral = collateralOptions[collId];
    TCN[msg.sender] +=
      vault.capital *
      (collateral.yieldIndex - vault.lastYieldIndex);

    vaults[collId][msg.sender].lastYieldIndex = collateral.yieldIndex;
  }

  /**
   * @notice Adds capital to the caller's vault
   * @param collId The ID of the collateral type being modified
   * @param treasuryAddress The address of the treasury contract
   * @param collAmount The amount of collateral to add
   * @param capitalAmount The amount of capital to add
   */
  function modifySupply(
    bytes32 collId,
    address treasuryAddress,
    int256 collAmount,
    int256 capitalAmount
  ) external {
    require(
      registry.checkIfValidContract("treasury", treasuryAddress),
      "VAULT: Treasury address is not valid"
    );

    collectInterest(collId);
    Vault storage vault = vaults[collId][msg.sender];
    vault.freeCollateral = sub(vault.freeCollateral, collAmount);
    vault.lockedCollateral = add(vault.lockedCollateral, collAmount);
    vault.capital = add(vault.capital, capitalAmount);

    collateralOptions[collId].normCapital = add(
      collateralOptions[collId].normCapital,
      capitalAmount
    );

    int256 aurToModify = mul(
      collateralOptions[collId].yieldIndex,
      capitalAmount
    );
    totalCapital = add(totalCapital, aurToModify);

    require(
      totalCapital <= collateralOptions[collId].ceiling,
      "VAULT: Supply ceiling reached"
    );
    require(
      vault.capital == 0 || vault.capital > collateralOptions[collId].floor,
      "VAULT: capital SMALLER THAN SMALLEST AMOUNT"
    );
    certify(collId, vault);

    AUR[treasuryAddress] = add(AUR[treasuryAddress], aurToModify);

    emit Log("vault", "modifySupply", msg.sender);
  }

  /**
   * @notice Modifies vault debt
   * @param collId The ID of the vault collateral type
   * @param treasuryAddress The address of the desired treasury contract
   * @param collAmount Amount of collateral supplied as loan security
   * @param debtAmount Amount of Aurei to borrow
   */
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
      AUR[treasuryAddress] >= uint256(debtAmount),
      "Treasury doesn't have enough supply to loan this amount"
    );
    Vault memory vault = vaults[collId][msg.sender];
    vault.freeCollateral = sub(vault.freeCollateral, collAmount);
    vault.lockedCollateral = add(vault.lockedCollateral, collAmount);
    vault.debt = add(vault.debt, debtAmount);

    collateralOptions[collId].normDebt = add(
      collateralOptions[collId].normDebt,
      debtAmount
    );

    int256 debtToModify = mul(
      collateralOptions[collId].interestIndex,
      debtAmount
    );
    totalDebt = add(totalDebt, debtToModify);

    require(
      totalDebt <= collateralOptions[collId].ceiling,
      "VAULT: Debt ceiling reached"
    );
    require(
      vault.debt == 0 || vault.debt > collateralOptions[collId].floor,
      "VAULT: Debt Smaller than floor"
    );
    certify(collId, vault);

    AUR[msg.sender] = add(AUR[msg.sender], debtToModify);
    AUR[treasuryAddress] = sub(AUR[treasuryAddress], debtToModify);

    vaults[collId][msg.sender] = vault;

    emit Log("vault", "modifyDebt", msg.sender);
  }

  /**
   * @notice Liquidates an undercollateralized vault
   * @param collId The ID of the vault collateral type
   * @param user The address of the vault to liquidate
   * @param auctioneer The address of the desired auctioneer contract
   * @param reservePool The address of the desired reserve pool contract
   * @param collateralAmount The amount of collateral to liquidate
   * @param debtAmount The amount of debt to clear
   * @param capitalAmount The amount of capital to clear
   */
  function liquidateVault(
    bytes32 collId,
    address user,
    address auctioneer,
    address reservePool,
    int256 collateralAmount,
    int256 debtAmount,
    int256 capitalAmount
  ) external onlyBy("liquidator") {
    Vault storage vault = vaults[collId][user];
    Collateral storage coll = collateralOptions[collId];

    vault.lockedCollateral = add(vault.lockedCollateral, collateralAmount);
    vault.debt = add(vault.debt, debtAmount);
    vault.capital = add(vault.capital, capitalAmount);
    coll.normDebt = add(coll.normDebt, debtAmount);
    coll.normCapital = add(coll.normCapital, capitalAmount);
    int256 aurToRaise = mul(coll.interestIndex, debtAmount) +
      mul(PRECISION_PRICE, capitalAmount);

    vaults[collId][auctioneer].freeCollateral = sub(
      vaults[collId][auctioneer].freeCollateral,
      collateralAmount
    );
    unbackedAurei[reservePool] = sub(unbackedAurei[reservePool], aurToRaise);
    totalunbackedAurei = sub(totalunbackedAurei, aurToRaise);

    emit Log("vault", "liquidateVault", msg.sender);
  }

  /**
   * @notice Used for settlement by the reserve pool
   * @param amount The amount to settle
   * TODO: Do we also need to add a way to increase totalunbackedAurei?
   */
  function settle(uint256 amount) external onlyByRegistered {
    AUR[msg.sender] = AUR[msg.sender] - amount;
    unbackedAurei[msg.sender] = unbackedAurei[msg.sender] - amount;
    emit Log("vault", "settle", msg.sender);
  }

  /// Admin-related functions

  /**
   * @dev Initializes a new collateral type
   * @param collId The collateral type ID
   */
  function initCollType(bytes32 collId) external onlyBy("gov") {
    collateralOptions[collId].interestIndex = PRECISION_PRICE;
    collateralOptions[collId].yieldIndex = PRECISION_PRICE;
  }

  /**
   * @dev Updates a collateral's debt ceiling
   * @param collId The collateral type ID
   * @param ceiling The new ceiling amount
   */
  function updateCeiling(bytes32 collId, uint256 ceiling)
    external
    onlyBy("gov")
  {
    emit LogVarUpdate(
      "Vault",
      collId,
      "ceiling",
      collateralOptions[collId].ceiling,
      ceiling
    );
    collateralOptions[collId].ceiling = ceiling;
  }

  /**
   * @notice Updates a collateral's debt floor
   * @dev Prevent users from creating multiple vaults with very low debt amount and collateral
   * @param collId The collateral type ID
   * @param floor The new floor amount
   */
  function updateFloor(bytes32 collId, uint256 floor) external onlyBy("gov") {
    emit LogVarUpdate(
      "Vault",
      collId,
      "floor",
      collateralOptions[collId].floor,
      floor
    );
    collateralOptions[collId].floor = floor;
  }

  /**
   * @dev Updates cumulative indices for the specified collateral type
   * @param collId The collateral type ID
   * @param interestIndex The new rate accumulator for debt
   * @param yieldIndex The new rate accumulator for capital
   */
  function updateAccumulators(
    bytes32 collId,
    uint256 interestIndex,
    uint256 yieldIndex
  ) external onlyBy("teller") {
    emit LogVarUpdate(
      "Vault",
      collId,
      "interestIndex",
      collateralOptions[collId].interestIndex,
      interestIndex
    );
    emit LogVarUpdate(
      "Vault",
      collId,
      "yieldIndex",
      collateralOptions[collId].yieldIndex,
      yieldIndex
    );

    collateralOptions[collId].interestIndex = interestIndex;
    collateralOptions[collId].yieldIndex = yieldIndex;
  }

  /**
   * @dev Updates the price of a collateral type
   * @param collId The collateral type ID
   * @param price The new price
   */
  function updatePrice(bytes32 collId, uint256 price)
    external
    onlyByRegistered
  {
    emit LogVarUpdate(
      "Vault",
      collId,
      "price",
      collateralOptions[collId].price,
      price
    );
    collateralOptions[collId].price = price;
  }

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  /**
   * @dev Certifies that the vault meets the collateral requirement
   * @param collId The collateral type ID
   * @param vault The vault to certify
   */
  function certify(bytes32 collId, Vault memory vault) internal view {
    require(
      (vault.debt * collateralOptions[collId].interestIndex) +
        (vault.capital * PRECISION_PRICE) <=
        vault.lockedCollateral * collateralOptions[collId].price,
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
