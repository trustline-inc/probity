pragma solidity ^0.8.0;

import "../Dependencies/Stateful.sol";
import "../Dependencies/DSMath.sol";

interface VaultLike {
  function updatePrice(bytes32 collId, uint256 price) external;
}

interface ftsoLike {
  function getCurrentPrice()
    external
    returns (uint256 _price, uint256 _timestamp);
}

contract PriceFeed is Stateful, DSMath {
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
    collTypes[collId].minCollRatio = minCollRatio;
  }

  function updateFtso(bytes32 collId, ftsoLike newFtso) external onlyBy("gov") {
    emit LogVarUpdate(
      "priceFeed",
      collId,
      "ftso",
      collTypes[collId].ftso,
      ftso
    );
    collTypes[collId].ftso = ftso;
  }

  // @todo figure out how many places of precision the ftso provides and fix the math accordingly
  function updatePrice(bytes32 collId) external {
    require(
      collTypes[collId].ftso != address(0),
      "PriceFeed: Collateral Type is not"
    );
    (uint256 price, ) = collTypes[collId].ftso.getCurrentPrice();
    uint256 adjustedPrice =
      rdiv(rdiv(mul(price, 10**9), 10**27), collTypes[collId].minCollRatio);

    vault.updatePrice(collId, adjustedPrice);
  }
}
