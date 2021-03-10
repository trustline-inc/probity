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
  uint256 cumulativeRate;

  ITeller public teller;
  IRegistry public registry;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);

    // Defaults
    lastUpdate = block.timestamp;
    cumulativeRate = ONE;
    variableRate = ONE; // Default rate set to 0% APY
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
   * @param lender - Address of lender
   * @param borrower - Address of borrower
   * @param amount - Principal of loan
   * @param rate - The interest rate in MPR (moment percentage rate)
   * @dev TODO: Verify payload was signed by lender and borrower
   */
  function executeOrder(
    address lender,
    address borrower,
    uint256 amount,
    uint256 rate
  ) external override {
    // Calculate new rate accumulator
    uint256 tmp =
      rmul(rpow(rate, block.timestamp - lastUpdate, ONE), cumulativeRate);

    // Create loan
    teller.createLoan(lender, borrower, amount, tmp);

    // Set new rates
    cumulativeRate = tmp;
    variableRate = rate;
  }

  function getVariableRate() external view returns (uint256) {
    return variableRate;
  }

  function getCumulativeRate() external view returns (uint256) {
    return cumulativeRate;
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
}
