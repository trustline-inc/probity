// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IProbity.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Teller is ITeller, Ownable, ProbityBase {
  using SafeMath for uint256;

  // --- Data ---
  /*
   * Borrower can have multiple loans running at the same time from same or different lenders.
   * For every loan, Loan-id is created against details such as rate, principal, duration, startDate and lender.
   */
  struct Loan {
    uint256 interestRate;
    uint256 principal;
    uint256 duration;
    uint256 startDate;
    address lender;
  }
  uint256 private _index;
  mapping(address => uint256) public balances;
  mapping(address => mapping(uint256 => Loan)) public loanBalances;

  ITreasury public treasury;
  IRegistry public registry;
  IProbity public probity;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
    _index = 0;
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    probity = IProbity(registry.getContractAddress(Contract.Probity));
  }

  /**
   * @notice Creates a loan by decrease the equity balance of the lender,
   * increasing the debt balance of the borrower, and sending the Aurei
   * to the borrower.
   * Steps for loan grant:
   * a. Teller requests Treasury for borrower eligibility against loan amount
   * b. Teller adds loan details to the loanBalances mapping.
   * c. Teller asks Treasury for transferring equity to borrower
   * d. Loan Granted.
   * @param lender - The address of the lender.
   * @param borrower - The address of the borrower.
   * @param principal - The initial amount of the loan.
   *Todo: List below:
   * 1. Take loan duration as input
   * 2. Check solidity behaviour if last step of function execution fails (assuming all storage updates must be reverted). Write test to verify same.
   * 3. Function sharing shared variable are thread safe. If multiple calls to function at same time, it must be handled by solidity.
   */
  function createLoan(
    address lender,
    address borrower,
    uint256 principal,
    uint256 rate
  ) external override onlyExchange {
    //Update total loan balance
    balances[borrower] = balances[borrower].add(principal);

    //Check borrower eligibility
    probity.checkBorrowerEligibility(balances[borrower], borrower);

    //Setup loan
    loanBalances[borrower][_index].interestRate = rate;
    loanBalances[borrower][_index].principal = principal;
    loanBalances[borrower][_index].duration = 90; //take as input
    loanBalances[borrower][_index].lender = lender;
    loanBalances[borrower][_index].startDate = block.timestamp;

    //Execute Equity transfer to borrower
    treasury.transferEquity(lender, borrower, principal);

    //Increment loan Index
    _index = _index + 1;
    emit LoanCreated(lender, borrower, principal, rate, block.timestamp);
  }

  // --- Modifiers ---

  /**
   * @dev Ensure that msg.sender === Exchange contract address.
   */
  modifier onlyExchange {
    require(msg.sender == registry.getContractAddress(Contract.Exchange));
    _;
  }
}
