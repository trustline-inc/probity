// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "./Dependencies/DSMath.sol";
import "./Dependencies/Ownable.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IFtso.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IVault.sol";
import "hardhat/console.sol";

/**
 * @notice Creates loans and manages vault debt.
 */
contract TellerOld is ITeller, Ownable, Base, DSMath {
  // --- Data ---
  uint256 public debtAccumulator; // Rate accumulator [ray]
  uint256 public capitalAccumulator; // Rate accumulator scaled by utilization
  uint256 public utilization; // Aurei reserve utilization
  uint256 public lastUpdate; // Timestamp of last rate update
  uint256 public APR; // Annualized percentage rate
  uint256 public MPR; // Momentized percentage rate

  uint256 public debt; // Normalized aggregate debt [ray]
  mapping(address => uint256) public debts; // Normalized individual debt [ray]

  IAurei public aurei;
  IFtso public ftso;
  IRegistry public registry;
  ITreasury public treasury;
  IVault public vault;

  struct LiquidateLocalVars {
    uint256 collateralAmount;
    uint256 collateralPrice;
    uint256 collateralValue;
    uint256 purchasePrice;
    uint256 protocolFee;
  }

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);

    // Set defaults
    lastUpdate = 0;
    utilization = 0;
    debtAccumulator = RAY;
    capitalAccumulator = RAY;
    APR = RAY;
    MPR = RAY;
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    ftso = IFtso(registry.getContractAddress(Contract.Ftso));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- Functions ---

  /**
   * @notice Returns the total debt balance of a borrower.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    return rmul(debts[owner], debtAccumulator);
  }

  function getAPR() external view override returns (uint256) {
    return APR;
  }

  function getMPR() external view override returns (uint256) {
    return MPR;
  }

  function getDebtAccumulator() external view override returns (uint256) {
    return debtAccumulator;
  }

  function getCapitalAccumulator() external view override returns (uint256) {
    return capitalAccumulator;
  }

  /**
   * @notice Gets the utilization rate and quantities
   * @return Total principal, total supply, and utilization rate.
   */
  function getUtilization()
    external
    view
    override
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 _totalPrincipal =
      sub(aurei.totalSupply(), aurei.balanceOf(address(treasury)));
    uint256 _totalSupply = aurei.totalSupply();
    uint256 _utilization = wdiv(_totalPrincipal, _totalSupply);
    return (_totalPrincipal, _totalSupply, _utilization);
  }

  function totalDebt() external view override returns (uint256) {
    return rmul(debt, debtAccumulator);
  }

  /**
   * @notice Creates a loan.
   * @param principal - The initial amount of the loan.
   */
  function createLoan(uint256 principal)
    external
    payable
    override
    checkEligibility(principal)
  {
    // Deposit borrower collateral
    vault.deposit{value: msg.value}(Activity.Borrow, msg.sender);

    // Check Treasury's Aurei balance
    uint256 reserves = aurei.balanceOf(address(treasury));
    require(reserves >= principal, "TELLER: Not enough reserves.");

    // Increase normalized individual and aggregate debt
    uint256 normalized = rdiv(principal, debtAccumulator);
    debts[msg.sender] = add(debts[msg.sender], normalized);
    debt = add(debt, normalized);

    // Send Aurei to borrower
    treasury.fundLoan(msg.sender, principal);

    // Update interest rate
    this.updateRate();

    // Emit event
    emit LoanCreated(principal, msg.value, block.timestamp, APR, msg.sender);
  }

  /**
   * @notice Repays debt
   * @param amount - The amount of Aurei to repay
   * @param collateral - The amount of collateral to unlock
   * @dev Contract must first be approved to transfer.
   */
  function repay(uint256 amount, uint256 collateral)
    external
    override
    checkRequestedCollateral(amount, collateral)
  {
    // Transfer Aurei from borrower to treasury
    aurei.transferFrom(msg.sender, address(treasury), amount);

    // Decrease normalized individual and aggregate debt
    uint256 normalized = rdiv(amount, debtAccumulator);
    debts[msg.sender] = sub(debts[msg.sender], normalized);
    debt = sub(debt, normalized);

    // Update interest rate
    this.updateRate();

    // Return collateral
    vault.withdraw(Activity.Repay, msg.sender, msg.sender, collateral);

    // Emit event
    emit Repayment(amount, collateral, block.timestamp, msg.sender);
  }

  function updateRate() external override onlyTellerOrTreasury {
    // Only runs on first update
    if (lastUpdate == 0) lastUpdate = block.timestamp;

    // Update debt accumulator
    if (utilization > 0)
      debtAccumulator = rmul(
        rpow(MPR, (block.timestamp - lastUpdate)),
        debtAccumulator
      );

    // Update capital accumulator
    uint256 multipliedByUtilization = rmul(sub(MPR, RAY), utilization * 1e9);
    uint256 multipliedByUtilizationPlusOne = add(multipliedByUtilization, RAY);
    uint256 exponentiated =
      rpow(multipliedByUtilizationPlusOne, (block.timestamp - lastUpdate));
    capitalAccumulator = rmul(exponentiated, capitalAccumulator);

    // Set new APR (round to nearest 0.25%)
    uint256 borrows =
      sub(aurei.totalSupply(), aurei.balanceOf(address(treasury)));
    utilization = wdiv(borrows, aurei.totalSupply());
    uint256 round = 0.0025 * 10**27;
    uint256 oneMinusUtilization = sub(RAY, utilization * 1e9);
    uint256 oneDividedByOneMinusUtilization =
      rdiv(10**27 * 0.01, oneMinusUtilization);
    APR = add(oneDividedByOneMinusUtilization, RAY);
    APR = ((APR + round - 1) / round) * round;
    require(APR <= MAX_APR, "TELLER: Max APR exceeed.");

    // Set new MPR
    MPR = APR_TO_MPR[APR];

    // Update time index
    lastUpdate = block.timestamp;
  }

  /**
   * @notice Liquidates a borrower's position
   * @param borrower - Borrower address
   */
  function liquidate(address borrower, uint256 purchasePrice)
    external
    override
    checkLiquidationElegibility(borrower, purchasePrice)
  {
    LiquidateLocalVars memory vars;
    (vars.collateralAmount, ) = vault.balanceOf(borrower);
    vars.collateralPrice = ftso.getPrice();
    vars.collateralValue = wdiv(
      wmul(vars.collateralAmount, vars.collateralPrice),
      100
    );
    vars.purchasePrice = purchasePrice;
    vars.protocolFee = 1; // TODO: Assess protocol fee

    // Send Aurei to the treasury
    aurei.transferFrom(msg.sender, address(treasury), vars.purchasePrice);

    // Clear loan balance
    uint256 normalized = rdiv(debts[borrower], debtAccumulator);
    debts[borrower] = 0;
    debt = sub(debt, normalized);

    // Send loan collateral to liquidator
    vault.withdraw(
      Activity.LiquidateLoan,
      borrower,
      msg.sender,
      vars.collateralAmount
    );

    emit Liquidation(
      vars.collateralAmount,
      vars.collateralValue,
      vars.purchasePrice,
      vars.protocolFee,
      block.timestamp,
      borrower,
      msg.sender
    );
  }

  // --- Modifiers ---

  modifier checkLiquidationElegibility(
    address borrower,
    uint256 purchasePrice
  ) {
    (uint256 loanCollateral, uint256 stakedCollateral) =
      vault.balanceOf(borrower);
    uint256 borrowerDebt = this.balanceOf(borrower);
    uint256 collateralPrice = ftso.getPrice();
    uint256 ratio =
      wdiv((wdiv(wmul(loanCollateral, collateralPrice), 100)), borrowerDebt);
    require(
      ratio <= LIQUIDATION_RATIO,
      "TELLER: Liquidation threshold not exceeded"
    );
    require(
      purchasePrice >= borrowerDebt,
      "TELLER: Purchase price must be greater than or equal to the par value of the borrower debt."
    );
    _;
  }

  /**
   * @notice Ensures that the borrower has sufficient collateral to secure a loan,
   * and that it meets the minimum collateral ratio requirement.
   * @param principal - The principal amount of Aurei.
   */
  modifier checkEligibility(uint256 principal) {
    (uint256 loanCollateral, uint256 stakedCollateral) =
      vault.balanceOf(msg.sender);
    uint256 collateralPrice = ftso.getPrice();
    uint256 ratio =
      wdiv(wdiv(wmul(msg.value, collateralPrice), 100), principal);
    require(
      ratio >= LIQUIDATION_RATIO,
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
    (uint256 loanCollateral, uint256 stakedCollateral) =
      vault.balanceOf(msg.sender);

    // Ensure that the collateral ratio after the repayment is sufficient
    uint256 collateralPrice = ftso.getPrice();
    uint256 ratio =
      wdiv(
        wdiv(wmul(sub(loanCollateral, requested), collateralPrice), 100),
        sub(rmul(debts[msg.sender], debtAccumulator), repayment)
      );
    require(
      ratio >= LIQUIDATION_RATIO,
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

  /**
   * @dev Ensure that msg.sender === Treasury || msg.sender === Teller contract address.
   */
  modifier onlyTellerOrTreasury {
    require(
      msg.sender == registry.getContractAddress(Contract.Treasury) ||
        msg.sender == registry.getContractAddress(Contract.Teller)
    );
    _;
  }
}
