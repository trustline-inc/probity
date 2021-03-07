// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Interfaces/ICustodian.sol";
import "./Interfaces/IProbity.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Teller is ITeller, Ownable, ProbityBase {
  using SafeMath for uint256;

  // --- Data ---

  /**
   * Borrower can have multiple loans running at the same time from same or different lenders.
   * For every loan, a loan ID is created against details such as rate, principal, duration, startDate and lender.
   */
  struct Loan {
    uint256 interestRate;
    uint256 principal;
    uint256 duration;
    uint256 startDate;
    address lender;
  }

  mapping(address => uint256) public balances;
  mapping(address => mapping(uint256 => Loan)) public loanBalances;
  mapping(address => uint256) private nonces;

  ICustodian public custodian;
  IProbity public probity;
  IRegistry public registry;
  ITreasury public treasury;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    custodian = ICustodian(registry.getContractAddress(Contract.Custodian));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    probity = IProbity(registry.getContractAddress(Contract.Probity));
  }

  // --- Functions ---

  /**
   * @notice Returns the debt balance of a borrower.
   */
  function balanceOf(address borrower)
    external
    view
    override
    returns (uint256)
  {
    return balances[borrower];
  }

  /**
   * @notice Creates a loan by decrease the equity balance of the lender,
   * increasing the debt balance of the borrower, and sending the Aurei
   * to the borrower thereby creating a loan asset for the lender.
   * Steps for loan grant:
   * a. Teller requests Treasury for borrower eligibility against loan amount
   * b. Teller adds loan details to the loanBalances mapping.
   * c. Teller asks Treasury to create loan by transferring Aurei to borrower
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
    uint256 newDebtBalance = balances[borrower].add(principal);

    // Check borrower eligibility
    custodian.checkBorrowerEligibility(newDebtBalance, borrower);

    // Update total loan balance
    balances[borrower] = balances[borrower].add(principal);

    // Set loan ID
    nonces[borrower] = nonces[borrower] + 1;
    uint256 index = nonces[borrower];

    // Setup loan
    loanBalances[borrower][index].interestRate = rate;
    loanBalances[borrower][index].principal = principal;
    loanBalances[borrower][index].duration = 0; // 0 indicates on-demand loan.
    loanBalances[borrower][index].lender = lender;
    loanBalances[borrower][index].startDate = block.timestamp;

    // Convert lender equity to loan asset
    treasury.convertLenderEquityToLoan(lender, borrower, principal);

    emit LoanCreated(lender, borrower, principal, rate, block.timestamp);
  }

  /**
   * @notice Calculates interest owed at time of call.
   */
  function calculateInterest() external {}

  // --- Modifiers ---

  /**
   * @dev Ensure that msg.sender === Exchange contract address.
   */
  modifier onlyExchange {
    require(msg.sender == registry.getContractAddress(Contract.Exchange));
    _;
  }
}
