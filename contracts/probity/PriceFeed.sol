// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/DSMath.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
  function updatePrice(bytes32 collId, uint256 price) external;
}

interface ftsoLike {
  function getCurrentPrice()
    external
    returns (uint256 _price, uint256 _timestamp);
}

contract PriceFeed is Stateful, Eventful, DSMath {
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
  VaultEngineLike vaultEngine;
  mapping(bytes32 => Collateral) collateralOptions;

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

  function init(
    bytes32 collId,
    uint256 minCollRatio,
    ftsoLike ftso
  ) external onlyBy("gov") {
    collateralOptions[collId].minCollRatio = minCollRatio;
    collateralOptions[collId].ftso = ftso;
  }

  function updateMinCollRatio(bytes32 collId, uint256 newMinCollRatio)
    external
    onlyBy("gov")
  {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "minCollRatio",
      collateralOptions[collId].minCollRatio,
      newMinCollRatio
    );
    collateralOptions[collId].minCollRatio = newMinCollRatio;
  }

  function updateFtso(bytes32 collId, ftsoLike newFtso) external onlyBy("gov") {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "ftso",
      address(collateralOptions[collId].ftso),
      address(newFtso)
    );
    collateralOptions[collId].ftso = newFtso;
  }

  // @todo figure out how many places of precision the ftso provides and fix the math accordingly
  function updatePrice(bytes32 collId) external {
    require(
      address(collateralOptions[collId].ftso) != address(0),
      "PriceFeed: Collateral Type is not"
    );
    (uint256 price, ) = collateralOptions[collId].ftso.getCurrentPrice();
    uint256 adjustedPrice = rdiv(
      rdiv(price, 10**27),
      collateralOptions[collId].minCollRatio
    );

    vaultEngine.updatePrice(collId, adjustedPrice);
  }
}
