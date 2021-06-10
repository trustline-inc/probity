// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./libraries/Base.sol";
import "./libraries/DSMath.sol";
import "./interfaces/IAurei.sol";
import "./interfaces/IAureiMarket.sol";
import "./interfaces/IComptroller.sol";
import "./interfaces/IFtso.sol";
import "./interfaces/IRegistry.sol";
import "hardhat/console.sol";

/**
 * @notice Manages liquidity pools.
 */
contract Comptroller is IComptroller, Base, DSMath {
  IAurei public aurei;
  IAureiMarket public aureiMarket;
  IFtso public ftso;
  IRegistry public registry;

  constructor(address _registry) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Initialize dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    ftso = IFtso(registry.getContractAddress(Contract.Ftso));
  }

  /**
   * @notice Deposits into FLR/AUR liquidity pool
   * @param market - Address of an FLR/AUR market contract
   */
  function deposit(address market) external payable override {
    aureiMarket = IAureiMarket(market);

    uint256 aureiReserves = aurei.balanceOf(market);
    uint256 sparkReserves = market.balance;

    uint256 price = ftso.getPrice();

    // Ensure pool ratio is maintained to FLR/XAU
    uint256 mintedAurei = wdiv(msg.value, wdiv(wmul(price, 1 ether), 100));

    // Mint Aurei to meet the peg
    aurei.mint(address(this), mintedAurei);
    aurei.approve(market, mintedAurei);

    uint256 endOfTime = 2**256 - 1;
    uint256 initialLiquidity =
      aureiMarket.addLiquidity{value: msg.value}(0, mintedAurei, endOfTime);

    console.log("initialAureiReserves :", aureiReserves);
    console.log("initialSparkReserves :", sparkReserves);
    console.log("initialLiquidity     :", initialLiquidity);
    console.log("mintedAurei          :", mintedAurei);
    console.log("newAureiReserves     :", aurei.balanceOf(market));
    console.log("newSparkReserves     :", market.balance);
  }
}
