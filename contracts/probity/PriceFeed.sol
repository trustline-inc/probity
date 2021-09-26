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
    uint256 liquidationRatio;
    ftsoLike ftso;
  }

  /////////////////////////////////////////
  // Data Variables
  /////////////////////////////////////////
  VaultEngineLike vaultEngine;
  mapping(bytes32 => Collateral) collateralTypes;

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
    uint256 liquidationRatio,
    ftsoLike ftso
  ) external onlyBy("gov") {
    collateralTypes[collId].liquidationRatio = liquidationRatio;
    collateralTypes[collId].ftso = ftso;
  }

  function updateLiquidationRatio(bytes32 collId, uint256 liquidationRatio)
    external
    onlyBy("gov")
  {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "liquidationRatio",
      collateralTypes[collId].liquidationRatio,
      liquidationRatio
    );
    collateralTypes[collId].liquidationRatio = liquidationRatio;
  }

  function updateFtso(bytes32 collId, ftsoLike newFtso) external onlyBy("gov") {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "ftso",
      address(collateralTypes[collId].ftso),
      address(newFtso)
    );
    collateralTypes[collId].ftso = newFtso;
  }

  // @todo figure out how many places of precision the ftso provides and fix the math accordingly
  function updatePrice(bytes32 collId) external {
    require(
      address(collateralTypes[collId].ftso) != address(0),
      "PriceFeed: Collateral Type is not"
    );
    (uint256 price, ) = collateralTypes[collId].ftso.getCurrentPrice();
    uint256 adjustedPrice = rdiv(
      rdiv(price, 10**27),
      collateralTypes[collId].liquidationRatio
    );

    vaultEngine.updatePrice(collId, adjustedPrice);
  }
}
