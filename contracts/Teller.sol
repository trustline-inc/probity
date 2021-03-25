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

  uint256 public debt; // Aggregate Normalized Debt
  mapping(address => uint256) public debts; // Individual Normalized Debt

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
   * @notice Returns the total debt balance of a borrower.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    return wmul(debts[owner], accumulator);
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
    console.log("Pool:        ", pool);

    // Increase individual debt
    debts[msg.sender] = add(debts[msg.sender], principal);

    // Increase aggregate debt
    debt = add(debt, principal);

    // Calculate new interest rate
    uint256 equity = treasury.totalEquity();
    uint256 apr = rdiv(RAY, sub(RAY, rdiv(debt * 1e9, equity * 1e9)));
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
    console.log("Accumulator: ", tmp);
    console.log("Last Update: ", lastUpdate);
    console.log("Timestamp:   ", block.timestamp);
    console.log("New Accum.:  ", accumulator);

    // Send Aurei to borrower
    treasury.fundLoan(msg.sender, principal);

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
