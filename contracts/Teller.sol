// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/DSMath.sol";
import "./Dependencies/Ownable.sol";
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

  uint256 public accumulator; // Rate accumulator [ray]
  uint256 public lastUpdate; // Timestamp of last rate update
  uint256 public rate; // Current interest rate [ray]

  uint256 public debt; // Normalized aggregate debt [ray]
  mapping(address => uint256) public debts; // Normalized individual debt [ray]

  IAurei public aurei;
  IRegistry public registry;
  ITreasury public treasury;
  IVault public vault;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);

    // Set defaults
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
   * @notice Returns the total debt balance of a borrower.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    return rmul(debts[owner], accumulator);
  }

  function getRate() external view override returns (uint256) {
    return rate;
  }

  function getAccumulator() external view override returns (uint256) {
    return accumulator;
  }

  function totalDebt() external view override returns (uint256) {
    return rmul(debt, accumulator);
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
    require(pool >= principal);

    // Update interest rate
    updateRate(principal, 0);

    // Calculate normalized principal sum
    uint256 normalized = rdiv(principal, accumulator);

    // Increase normalized individual debt
    debts[msg.sender] = add(debts[msg.sender], normalized);

    // Increase normalized aggregate debt
    debt = add(debt, normalized);

    // Send Aurei to borrower
    treasury.fundLoan(msg.sender, principal);

    // Emit event
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
    // Transfer Aurei from borrower to treasury
    aurei.transferFrom(msg.sender, address(this), amount);

    // Update interest rate
    updateRate(amount, 1);

    // Calculate normalized repayment amount
    uint256 normalized = rdiv(amount, accumulator);

    // Decrease normalized individual debt
    debts[msg.sender] = sub(debts[msg.sender], normalized);

    // Decrease normalized aggregate debt
    debt = sub(debt, normalized);

    // Unlock collateral
    vault.unlock(msg.sender, collateral);

    // Emit event
    emit Repayment(msg.sender, amount, collateral, block.timestamp);
  }

  // --- Internal Functions ---

  function updateRate(uint256 delta, uint256 op) internal {
    // Calculate new interest rate
    uint256 equity = treasury.totalSupply();

    uint256 apr;

    // New Loan (add the delta)
    if (op == 0) {
      uint256 newDebt = add(rmul(debt, accumulator), delta);
      require(newDebt != equity, "TELL: Not enough supply.");
      apr = rdiv(RAY, sub(RAY, rdiv(newDebt * 1e9, equity * 1e9)));
    }

    // Repayment (subtract the delta)
    if (op == 1) {
      apr = rdiv(
        RAY,
        sub(RAY, rdiv(sub(rmul(debt, accumulator), delta) * 1e9, equity * 1e9))
      );
    }

    uint256 mpr = RAY + (RAY / SECONDS_IN_YEAR);
    rate = apr; // Maybe should store this as MPR.

    // Calculate new rate accumulator
    accumulator = rmul(rpow(mpr, (block.timestamp - lastUpdate)), accumulator);
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
        sub(rmul(debts[msg.sender], accumulator), repayment)
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
