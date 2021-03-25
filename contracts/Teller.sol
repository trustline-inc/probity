// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/DSMath.sol";
import "./Dependencies/ProbityBase.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IVault.sol";
import "hardhat/console.sol";

/**
 * @notice Creates loans and manages vault debt.
 */
contract Teller is ITeller, Ownable, ProbityBase, DSMath {
  // --- Data ---

  uint256 public utilization;
  uint256 public rate;

  uint256 public debt; // Aggregate Normalized Debt
  mapping(address => uint256) public debts; // Individual Normalized Debt

  IAurei public aurei;
  IRegistry public registry;
  ITreasury public treasury;
  IVault public vault;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    // exchange = IExchange(registry.getContractAddress(Contract.Exchange));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- Functions ---

  /**
   * @notice Returns the total debt balance of a borrower.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    // uint256 rate = exchange.getCumulativeRate();
    // return debts[owner].mul(rate);
    // return debts[owner].mul(exchange.getCumulativeRate());
    return debts[owner];
  }

  function getRate() external view override returns (uint256) {
    return rate;
  }

  /**
   * @notice Creates a loan.
   * @param collateral - Amount of collateral used to secure the loan.
   * @param principal - The initial amount of the loan.
   */
  function createLoan(uint256 collateral, uint256 principal)
    external
    override
    checkEligibility(collateral, principal)
  {
    // Lock borrower collateral
    vault.lock(msg.sender, collateral);

    // Check Treasury's Aurei balance
    uint256 pool = aurei.balanceOf(address(treasury));
    console.log("Pool:  ", pool);

    // Increase individual debt
    debts[msg.sender] = add(debts[msg.sender], principal);

    // Increase aggregate debt
    debt = add(debt, principal);

    // Calculate new rate
    uint256 ONE = 1e18;
    uint256 equity = treasury.totalEquity();
    console.log("Debt:  ", debt);
    console.log("Equity:", equity);
    rate = wdiv(ONE, sub(ONE, wdiv(debt, equity)));
    console.log("Rate:  ", rate);

    // Send Aurei to borrower
    aurei.transfer(msg.sender, principal);

    emit LoanCreated(msg.sender, collateral, principal, rate, block.timestamp);
  }

  function totalDebt() external view override returns (uint256) {
    return debt;
  }

  // --- Modifiers ---

  /**
   * @notice Ensures that the borrower has sufficient collateral to secure a loan,
   * and that it meets the minimum collateral ratio requirement.
   * @param collateral - The amount of collateral securing the loan.
   * @param principal - The principal amount of Aurei.
   */
  modifier checkEligibility(uint256 collateral, uint256 principal) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);
    require(unencumbered >= collateral, "TELL: Collateral not available.");

    // TODO: Hook in collateral price
    uint256 ratio = wdiv(wmul(collateral, 1 ether), principal);
    require(
      ratio >= MIN_COLLATERAL_RATIO,
      "PRO: Insufficient collateral provided"
    );
    _;
  }

  /**
   * @dev Ensure that msg.sender === Treasury contract address.
   */
  modifier onlyTreasury {
    require(msg.sender == registry.getContractAddress(Contract.Treasury));
    _;
  }
}
