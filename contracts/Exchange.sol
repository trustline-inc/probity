// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Interfaces/IExchange.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";

/**
 * @notice Executes signed loan orders.
 */
contract Exchange is IExchange, Ownable, ProbityBase {

  // --- Data ---
  
  ITeller public teller;
  IRegistry public registry;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
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
   */
  function executeOrder(address lender, address borrower, uint amount, uint rate) external override {
    teller.createLoan(lender, borrower, amount, rate);
  }
}
