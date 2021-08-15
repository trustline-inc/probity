pragma solidity ^0.8.4;

import "../Dependencies/Stateful.sol";
import "../Dependencies/Eventful.sol";

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
// Can we cancel everyone's extra supply?
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
      finalPrice[collId] != 0,
      "Shutdown/onlyIfFinalPriceSet: Final Price has not been set for this collId"
    );
    _;
  }

  /////////////////////////////////////////
  // Data Structure
  /////////////////////////////////////////

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  bool initiated;
  uint256 initiatedAt;
  mapping(bytes32 => uint256) finalPrice;
  mapping(bytes32 => uint256) amountUnderColl;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(address registryAddress) Stateful(registryAddress) {}

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  // once a shutdown has been initiated, you can no longer cancel it.
  function initiateShutdown() external onlyWhenNotInShutdown onlyBy("gov") {
    initiated = true;
    initiatedAt = block.timestamp;
    // do step 1 : freeze all related contracts
  }

  // step 2: set final prices
  function onlyWhenInShutdownMode(bytes32 collId) external onlyWhenInShutdown {
    // call the ftso/priceFeed? to get the price
    // if the FTSO contract is different for different coll types, how do we handle it?
  }

  function checkAndMoveUserVault(bytes32 collId, address user)
    external
    onlyIfFinalPriceSet(collId)
  {
    // call vault, check if it's under collateralized
    // if so, figure out how much it's under collateralized by, add it to the amount
    // else free up overCollateral
    // move the appropriate amount of collateral to shutdown's control
    // how much do we move? do we also move the supplier side's? if so, how do we handle left overs
    // do everyone get a share of the pot in every collateral? or only one collateral type?
  }

  function checkAndMoveUserVault(bytes32 collId, address user)
    external
    onlyIfFinalPriceSet(collId)
  {
    // call vault, check if it's under collateralized
    // if so, figure out how much it's under collateralized by, add it to the amount
    // else free up overCollateral
    // move the appropriate amount of collateral to shutdown's control
    // how much do we move? do we also move the supplier side's? if so, how do we handle left overs
    // do everyone get a share of the pot in every collateral? or only one collateral type?
  }

  function calculateRedeemRatio() {
    // read from the reserve pool about how reserve there is
    // read from vault about the system debt
    // system balance = reserve - system debt
  }

  function redeemCollateral(bytes32 collId) {}

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////
}
