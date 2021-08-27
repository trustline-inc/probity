// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Dependencies/Stateful.sol";
import "../Dependencies/DSMath.sol";
import "../Dependencies/Eventful.sol";

interface VaultLike {
  function updatePrice(bytes32 collId, uint256 price) external;
}

interface ftsoLike {
  function getCurrentPrice()
    external
    returns (uint256 _price, uint256 _timestamp);
}

contract PriceFeed is Stateful, Eventful, DSMath {
  /////////////////////////////////////////
  // Modifiers
  /////////////////////////////////////////

  modifier collateralExists(bytes32 collId) {
    require(
      address(collTypes[collId].ftso) != address(0),
      "PriceFeed/CollateralExists: Collateral Type is not Set"
    );
    _;
  }

  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////

  struct Collateral {
    uint256 minCollRatio;
    ftsoLike ftso;
  }

  /////////////////////////////////////////
  // Data Variables
  /////////////////////////////////////////
  VaultLike vault;
  mapping(bytes32 => Collateral) collTypes;

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

  function init(
    bytes32 collId,
    uint256 minCollRatio,
    ftsoLike ftso
  ) external onlyBy("gov") {
    collTypes[collId].minCollRatio = minCollRatio;
    collTypes[collId].ftso = ftso;
  }

  function updateMinCollRatio(bytes32 collId, uint256 newMinCollRatio)
    external
    onlyBy("gov")
  {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "minCollRatio",
      collTypes[collId].minCollRatio,
      newMinCollRatio
    );
    collTypes[collId].minCollRatio = newMinCollRatio;
  }

  function updateFtso(bytes32 collId, ftsoLike newFtso) external onlyBy("gov") {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "ftso",
      address(collTypes[collId].ftso),
      address(newFtso)
    );
    collTypes[collId].ftso = newFtso;
  }

  function getPrice(bytes32 collId)
    public
    collateralExists(collId)
    returns (uint256 price)
  {
    (price, ) = collTypes[collId].ftso.getCurrentPrice();
  }

  // @todo figure out how many places of precision the ftso provides and fix the math accordingly
  function updatePrice(bytes32 collId) external {
    uint256 price = getPrice(collId);
    uint256 adjustedPrice =
      rdiv(rdiv(price, 10**27), collTypes[collId].minCollRatio);

    vault.updatePrice(collId, adjustedPrice);
  }
}
