// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Teller is ITeller, Ownable, ProbityBase {
  using SafeMath for uint256;

  // --- Data ---

  mapping (address => uint) public balances;

  ITreasury public treasury;
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
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
  }

  /**
   * @notice Creates a loan by decrease the equity balance of the lender,
   * increasing the debt balance of the borrower, and sending the Aurei
   * to the borrower.
   * @param lender - The address of the lender.
   * @param borrower - The address of the borrower.
   * @param principal - The initial amount of the loan.
   */
  function createLoan(address lender, address borrower, uint principal, uint rate) external override onlyProbity {
    treasury.decrease(principal, lender);
    balances[borrower] = balances[borrower].add(principal);
    treasury.transfer(borrower, principal);
    emit LoanCreated(lender, borrower, principal, rate, block.timestamp);
  }

  // --- Modifiers ---

  /**
	 * @dev Ensure that msg.sender === Probity contract address.
	 */
	modifier onlyProbity {
		require(msg.sender == registry.getContractAddress(Contract.Probity));
		_;
	}

}
