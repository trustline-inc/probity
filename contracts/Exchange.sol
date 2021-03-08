// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Interfaces/IExchange.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "hardhat/console.sol";

/**
 * @notice Executes signed loan orders.
 */
contract Exchange is IExchange, Ownable, ProbityBase {
  // --- Data ---
  uint256 lastUpdate;
  uint256 variableRate;

  ITeller public teller;
  IRegistry public registry;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
    variableRate = 5; //Default rate set to 5% APY
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    teller = ITeller(registry.getContractAddress(Contract.Teller));
  }

  // --- External Functions ---

  /**
   * @notice Executes an off-chain order at the specified rate.
   * Steps for interest rate:
   * 1.
   * @dev TODO: Verify payload was signed by lender and borrower
   */
  function executeOrder(
    address lender,
    address borrower,
    uint256 amount,
    uint256 rate
  ) external override {
    teller.createLoan(lender, borrower, amount, rate);
    //updateGlobalInterestRate(rate);
    variableRate = rate;
    //Calculate interest
  }

  function getVariableRate() public view returns (uint256) {
    return variableRate;
  }

  // --- Internal Functions ---

  // https://github.com/makerdao/dss/blob/master/src/jug.sol#L92
  function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
    z = x * y;
    require(y == 0 || z / y == x);
    z = z / ONE;
  }

  // Taken from https://github.com/makerdao/dss/blob/master/src/jug.sol#L60
  function rpow(
    uint256 x,
    uint256 n,
    uint256 b
  ) internal pure returns (uint256 z) {
    assembly {
      switch x
        case 0 {
          switch n
            case 0 {
              z := b
            }
            default {
              z := 0
            }
        }
        default {
          switch mod(n, 2)
            case 0 {
              z := b
            }
            default {
              z := x
            }
          let half := div(b, 2) // for rounding.
          for {
            n := div(n, 2)
          } n {
            n := div(n, 2)
          } {
            let xx := mul(x, x)
            if iszero(eq(div(xx, x), x)) {
              revert(0, 0)
            }
            let xxRound := add(xx, half)
            if lt(xxRound, xx) {
              revert(0, 0)
            }
            x := div(xxRound, b)
            if mod(n, 2) {
              let zx := mul(z, x)
              if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) {
                revert(0, 0)
              }
              let zxRound := add(zx, half)
              if lt(zxRound, zx) {
                revert(0, 0)
              }
              z := div(zxRound, b)
            }
          }
        }
    }
  }

  /**
  function updateGlobalInterestRate(uint256 newRate) private {
    require(block.timestamp >= lastUpdate);
    uint256 factor = rpow(newRate, block.timestamp - lastUpdate, ONE);
    console.log("factor:", factor);
    uint256 product = rmul(factor, variableRate);
    console.log("product:", product);
    uint256 delta_rate = product;
    lastUpdate = block.timestamp;
    console.log("delta_rate:", delta_rate);
  }*/

  /**
    @notice When order is submitted to exchange and interest is changed, interest is calculated for all borrowers.
    @param rate - Interest rate for order.. Rate Multiplier.
    Todo: if so many orders executing in system, it's not worth to calculate every time. 
    * Devise better algorithm for executing interest rate. May be take average of varying interest rate for all orders through out day.
  */
  function settleInterestForBorrowers(uint256 rate) private {
    if (rate == variableRate) {
      return;
    } else {
      //teller.executeLoanInterest
    }
  }
}
