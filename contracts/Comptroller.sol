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

  fallback() external payable {}

  /**
   * @notice Initialize dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    ftso = IFtso(registry.getContractAddress(Contract.Ftso));
  }

  /**
   * @notice Deposits into AUR liquidity pool
   * @param market - Address of an AUR market contract
   */
  function deposit(address market) external payable override {
    aureiMarket = IAureiMarket(market);

    uint256 aureiReserves = aurei.balanceOf(market);
    uint256 sparkReserves = market.balance;

    uint256 price = ftso.getPrice();

    // Ensure pool ratio is maintained to FLR/XAU
    uint256 mint = wdiv(msg.value, wdiv(wmul(price, 1 ether), 100));

    // Mint Aurei to meet the peg
    aurei.mint(address(this), mint);
    aurei.approve(market, mint);

    uint256 endOfTime = 2**256 - 1;
    uint256 initialLiquidity =
      aureiMarket.addLiquidity{value: msg.value}(0, mint, endOfTime);
  }

  /**
   * @notice Withdraws from AUR liquidity pool
   * @param market - Address of an AUR market contract
   */
  function withdraw(
    address market,
    uint256 liquidityAmount,
    uint256 sparkAmount
  ) external override {
    aureiMarket = IAureiMarket(market);

    uint256 aureiReserves = aurei.balanceOf(market);
    uint256 sparkReserves = market.balance;

    uint256 price = ftso.getPrice();

    // Ensure pool ratio is pegged to FLR/XAU
    uint256 aureiAmount = wdiv(sparkAmount, wdiv(wmul(price, 1 ether), 100));

    uint256 endOfTime = 2**256 - 1;
    (uint256 _sparkAmount, uint256 _aureiAmount) =
      aureiMarket.removeLiquidity(
        liquidityAmount,
        sparkAmount,
        aureiAmount,
        endOfTime
      );

    // Burn Aurei to meet the peg
    aurei.burn(address(this), aureiAmount);
  }
}
