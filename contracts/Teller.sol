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

  uint256 public accumulator;
  uint256 public lastUpdate;
  uint256 public utilization;
  uint256 public rate;

  uint256 public debt; // Aggregate Debt
  uint256 public normDebt; // Normalized Aggregate Debt
  mapping(address => uint256) public debts; // Individual Debts
  mapping(address => uint256) public normDebts; // Normalized Individual Debts

  IAurei public aurei;
  IRegistry public registry;
  ITreasury public treasury;
  IVault public vault;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);

    lastUpdate = block.timestamp;
    accumulator = RAY;
    rate = RAY;
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- Functions ---

  /**
   * @notice Returns the total debt balance of a borrower [RAY].
   */
  function balanceOf(address owner) external view override returns (uint256) {
    return rmul(normDebts[owner], accumulator);
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
    console.log("===CREATING LOAN===");
    // Lock borrower collateral
    vault.lock(msg.sender, collateral);

    // Check Treasury's Aurei balance
    uint256 pool = aurei.balanceOf(address(treasury));
    console.log("Pool:        ", pool);

    // Set new aggregate debt
    debt = add(debt, principal);

    // Set new individual debt
    debts[msg.sender] = add(debts[msg.sender], principal);

    // Update interest rate
    updateRate(principal, 0);

    // Calculate normalized principal sum
    uint256 normalizedPrincipalSum = ((principal * RAY) / accumulator);
    console.log("normalizedPrincipalSum:", normalizedPrincipalSum);

    // Increase normalized individual debt
    normDebts[msg.sender] = add(normDebts[msg.sender], normalizedPrincipalSum);
    console.log("Norm Indv. Debt:", normDebts[msg.sender]);

    // Increase normalized aggregate debt
    normDebt = add(normDebt, normalizedPrincipalSum);
    console.log("Norm Aggr. Debt:", normDebt);

    console.log("Debt:        ", debt);
    console.log("Rate:        ", rate);
    console.log("Principal:   ", principal * 1e9);
    console.log("Princi./Acc.:", normalizedPrincipalSum);
    console.log("NDebt * Acc.:", rmul(normalizedPrincipalSum, accumulator));

    // Send Aurei to borrower
    treasury.fundLoan(msg.sender, principal);

    emit LoanCreated(msg.sender, collateral, principal, rate, block.timestamp);
  }

  /**
   * @notice Repays debt
   * @param amount - The amount of Aurei to repay
   * @param collateral - The amount of collateral to unlock
   * @dev Contract must first be approved to transfer.
   */
  function repay(uint256 amount, uint256 collateral)
    external
    checkRequestedCollateral(amount, collateral)
  {
    console.log("===MAKING REPAYMENT===");

    // Transfer Aurei from borrower to treasury
    aurei.transferFrom(msg.sender, address(this), amount);

    // Get previous accumulator
    uint256 prev = accumulator;
    console.log("accumulator old:    ", prev);

    // Update interest rate
    updateRate(amount, 1);
    console.log("accumulator new:    ", accumulator);
    console.log(
      "norm. debt new:     ",
      rdiv(normDebts[msg.sender], accumulator)
    );

    // Calculate normalized repayment amount
    uint256 normalizedRepayment = rdiv(amount, accumulator);
    console.log("normalizedRepayment:", normalizedRepayment);

    // Decrease normalized individual debt
    console.log("Norm Indv. Debt (Prev):", normDebts[msg.sender]);
    normDebts[msg.sender] = sub(normDebts[msg.sender], normalizedRepayment);
    console.log("Norm Indv. Debt (Aftr):", normDebts[msg.sender]);
    console.log(
      "Norm Indv. * Accum.   :",
      rmul(normDebts[msg.sender], accumulator)
    );

    // Decrease normalized aggregate debt
    normDebt = sub(normDebt, normalizedRepayment);
    console.log("Norm Aggr. Debt       :", normDebt);
    console.log("Norm Aggr. * Accum.   :", rmul(normDebt, accumulator));

    console.log("Repayment:   ", amount);
    console.log("Repaymt./Acc.:", normalizedRepayment);
    console.log("Rate:        ", rate);
    console.log("Debt:        ", debt);

    // Unlock collateral
    vault.unlock(msg.sender, collateral);
  }

  function totalDebt() external view override returns (uint256) {
    return debt;
  }

  // --- Internal Functions ---

  function updateRate(uint256 delta, uint256 op) internal {
    console.log("===RATE UPDATING===");
    // Calculate new interest rate
    uint256 equity = treasury.totalEquity();

    uint256 apr;

    // New Loan (add delta)
    if (op == 0) {
      apr = rdiv(
        RAY,
        sub(
          RAY,
          rdiv(add(rmul(normDebt, accumulator), delta) * 1e9, equity * 1e9)
        )
      );
    }

    // Repayment (sub delta)
    if (op == 1) {
      apr = rdiv(
        RAY,
        sub(
          RAY,
          rdiv(sub(rmul(normDebt, accumulator), delta) * 1e9, equity * 1e9)
        )
      );
    }

    uint256 mpr = RAY + (RAY / SECONDS_IN_YEAR);
    uint256 tmp = accumulator;
    rate = apr; // Maybe should store this as MPR.

    // Calculate new rate accumulator
    accumulator = rmul(rpow(mpr, (block.timestamp - lastUpdate)), accumulator);

    // View values
    console.log("Debt:        ", debt);
    console.log("Equity:      ", equity);
    console.log("APR:         ", apr);
    console.log("MPR:         ", mpr);
    console.log("Old Timestamp:", lastUpdate);
    console.log("New Timestamp:", block.timestamp);
    console.log("Chg Timestamp:", block.timestamp - lastUpdate);
    console.log("Old Accum.:  ", tmp);
    console.log("New Accum.:  ", accumulator);
    console.log("===RATE UPDATED===");
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
   * @notice Ensures that the borrower still meets the minimum collateral
   * ratio requirement when repaying a loan.
   * @param repayment - The amount of Aurei being repaid
   * @param requested - The amount of collateral to be unlocked
   */
  modifier checkRequestedCollateral(uint256 repayment, uint256 requested) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);

    // Ensure that the requested collateral amount is less than the encumbered amount
    require(encumbered >= requested, "TELL: Collateral not available.");

    // Ensure that the collateral ratio after the repayment is sufficient
    // TODO: Hook in collateral price
    uint256 ratio =
      wdiv(
        wmul(sub(encumbered, requested), 1 ether),
        sub(debts[msg.sender], repayment)
      );
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
