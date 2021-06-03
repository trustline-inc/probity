// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/DSMath.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IFtso.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITcnToken.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/IVault.sol";
import "hardhat/console.sol";

/**
 * @notice Manages capital for all vaults.
 */
contract Treasury is ITreasury, Ownable, Base, DSMath {
  using SafeMath for uint256;

  // --- Data ---

  uint256 public _totalSupply;
  mapping(address => uint256) public initialCapital;
  mapping(address => uint256) public normalizedCapital;

  IAurei public aurei;
  IFtso public ftso;
  IRegistry public registry;
  ITcnToken public tcnToken;
  ITeller public teller;
  IVault public vault;

  struct LiquidateLocalVars {
    uint256 collateralAmount;
    uint256 collateralPrice;
    uint256 collateralValue;
    uint256 liquidatorFee;
    uint256 protocolFee;
  }

  struct RedeemLocalVars {
    uint256 accumulator;
    uint256 collateral;
    uint256 capital;
  }

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Initialize dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    ftso = IFtso(registry.getContractAddress(Contract.Ftso));
    tcnToken = ITcnToken(registry.getContractAddress(Contract.TcnToken));
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- External Functions ---

  /**
   * @notice Returns the capital balance of a vault.
   */
  function capitalOf(address owner) external view override returns (uint256) {
    uint256 capitalAccumulator = teller.getCapitalAccumulator();
    uint256 capital = wmul(normalizedCapital[owner], capitalAccumulator) / 1e9;
    return capital;
  }

  /**
   * @notice Returns the interest balance of a vault.
   */
  function interestOf(address owner) external view override returns (uint256) {
    uint256 accumulator = teller.getCapitalAccumulator();
    uint256 capital = wmul(normalizedCapital[owner], accumulator) / 1e9;
    uint256 interest = capital - initialCapital[owner];
    return interest;
  }

  /**
   * @notice Adds capital to the system by minting Aurei to the treasury.
   * @param capital - Amount of Aurei to mint.
   */
  function stake(uint256 capital)
    external
    payable
    override
    checkStakingEligibility(capital)
  {
    vault.deposit{value: msg.value}(Activity.Stake, msg.sender);
    aurei.mint(address(this), capital);
    uint256 accumulator = teller.getCapitalAccumulator();
    normalizedCapital[msg.sender] = add(
      normalizedCapital[msg.sender],
      rdiv(capital, accumulator)
    );
    initialCapital[msg.sender] = initialCapital[msg.sender].add(capital);
    _totalSupply = _totalSupply.add(capital);
    teller.updateRate();
    emit Stake(capital, msg.value, block.timestamp, msg.sender);
  }

  /**
   * @notice Redeems capital from the treasury, decreasing the Aurei reserves.
   * @param collateral - The amount of collateral to redeem
   * @param capital - The amount of capital to redeem
   * @dev This adjusts the capital-collateral ratio
   * @dev TODO: Ensure collateral ratio is maintained.
   */
  function redeem(uint256 collateral, uint256 capital)
    external
    override
    checkRedemptionEligibility(collateral, capital)
  {
    RedeemLocalVars memory vars;
    vars.collateral = collateral;
    vars.capital = capital;
    vars.accumulator = teller.getCapitalAccumulator();

    // Reduce capital balance
    normalizedCapital[msg.sender] = sub(
      normalizedCapital[msg.sender],
      rdiv(capital, vars.accumulator)
    );
    initialCapital[msg.sender] = initialCapital[msg.sender].sub(vars.capital);
    _totalSupply = _totalSupply.sub(vars.capital);

    // Burn the Aurei
    require(
      aurei.balanceOf(address(this)) > vars.capital,
      "TREASURY: Not enough reserves."
    );
    aurei.burn(address(this), vars.capital);

    // Update the rate
    teller.updateRate();

    // Return collateral
    vault.withdraw(Activity.Redeem, msg.sender, msg.sender, vars.collateral);

    // Emit event
    emit Redemption(vars.capital, vars.collateral, block.timestamp, msg.sender);
  }

  /**
   * @notice Withdraws TCN from the vault.
   * @param amount - The amount of TCN to withdraw.
   * @dev https://docs.soliditylang.org/en/v0.4.24/common-patterns.html#withdrawal-from-contracts
   */
  function withdraw(uint256 amount, bool tcn) external override {
    // Calculate withdrawable TCN
    uint256 accumulator = teller.getCapitalAccumulator();
    uint256 capital = wmul(normalizedCapital[msg.sender], accumulator) / 1e9;
    uint256 interest = capital.sub(initialCapital[msg.sender]);
    require(amount <= interest, "TREASURY: Insufficient interest balance");

    // Reduce capital
    normalizedCapital[msg.sender] = sub(
      normalizedCapital[msg.sender],
      rdiv(amount, accumulator)
    );

    if (tcn) {
      // Burn AUR and mint TCN to caller
      aurei.burn(address(this), amount);
      tcnToken.mint(msg.sender, amount);
    } else {
      aurei.transfer(msg.sender, amount);
    }

    teller.updateRate();

    // Emit event
    emit Withdrawal(amount, 0, block.timestamp, msg.sender);
  }

  /**
   * @notice Funds a loan using Aurei from the treasury.
   * @param borrower - The address of the borrower.
   * @param principal - Principal amount of the loan.
   */
  function fundLoan(address borrower, uint256 principal)
    external
    override
    onlyTeller
  {
    aurei.transfer(borrower, principal);
  }

  /**
   * @notice Liquidates a supplier's position
   * @param supplier - Supplier address
   */
  function liquidate(address supplier)
    external
    override
    checkLiquidationElegibility(supplier)
  {
    LiquidateLocalVars memory vars;
    (, vars.collateralAmount) = vault.balanceOf(supplier);
    vars.collateralPrice = ftso.getPrice();
    vars.collateralValue = wdiv(
      wmul(vars.collateralAmount, vars.collateralPrice),
      100
    );
    vars.liquidatorFee = 1;
    vars.protocolFee = 1;

    // Clear capital balance (keep interest)
    uint256 capital = this.capitalOf(supplier);
    uint256 interest = this.interestOf(supplier);
    uint256 capitalMinusInterest = capital.sub(interest);
    console.log(aurei.balanceOf(address(this)));
    console.log(capitalMinusInterest);
    require(
      aurei.balanceOf(address(this)) > capitalMinusInterest,
      "TREASURY: Not enough reserves."
    );

    normalizedCapital[msg.sender] = 0;
    initialCapital[msg.sender] = 0;
    _totalSupply = _totalSupply.sub(capitalMinusInterest);

    // Send capitalized collateral to liquidity provider
    vault.withdraw(
      Activity.LiquidateStake,
      supplier,
      msg.sender,
      vars.collateralAmount
    );

    // Burn the Aurei
    aurei.burn(address(this), capitalMinusInterest);

    emit Liquidation(
      vars.collateralAmount,
      vars.collateralValue,
      vars.liquidatorFee,
      vars.protocolFee,
      block.timestamp,
      supplier,
      msg.sender
    );
  }

  /**
   * @dev requires approve call before
   */
  function recapitalize(uint256 amount) external payable override {}

  /**
   * @return Total AUR capital
   */
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  // --- Modifiers ---

  modifier checkLiquidationElegibility(address supplier) {
    (uint256 loanCollateral, uint256 stakedCollateral) =
      vault.balanceOf(supplier);
    uint256 capital = this.capitalOf(supplier);
    uint256 collateralPrice = ftso.getPrice();
    uint256 ratio =
      wdiv(wdiv(wmul(stakedCollateral, collateralPrice), 100), capital);
    require(
      ratio <= LIQUIDATION_RATIO,
      "TREASURY: Liquidation threshold not exceeded"
    );
    _;
  }

  /**
   * @notice Ensures that the owner has sufficient collateral to mint Aurei,
   * and that it meets the minimum collateral ratio requirement.
   * @param capital - The amount of Aurei.
   */
  modifier checkStakingEligibility(uint256 capital) {
    (uint256 loanCollateral, uint256 stakedCollateral) =
      vault.balanceOf(msg.sender);
    uint256 collateralPrice = ftso.getPrice();
    uint256 ratio = wdiv(wdiv(wmul(msg.value, collateralPrice), 100), capital);
    require(
      ratio >= LIQUIDATION_RATIO,
      "TREASURY: Insufficient collateral provided"
    );
    _;
  }

  /**
   * @notice Ensures that the owner has sufficient collateral after redemption,
   * and that it meets the minimum collateral ratio requirement.
   * @param collateralRequested - The amount of collateral to unlock.
   * @param capitalToRemove - The amount of Aurei to burn.
   */
  modifier checkRedemptionEligibility(
    uint256 collateralRequested,
    uint256 capitalToRemove
  ) {
    (uint256 loanCollateral, uint256 stakedCollateral) =
      vault.balanceOf(msg.sender);
    require(
      stakedCollateral >= collateralRequested,
      "TREASURY: Collateral not available."
    );

    // Get current capital balance
    uint256 accumulator = teller.getCapitalAccumulator();
    uint256 capital = wmul(normalizedCapital[msg.sender], accumulator) / 1e9;
    uint256 interest = this.interestOf(msg.sender);
    require(capital >= capitalToRemove, "TREASURY: Capital not available.");
    uint256 remainder = capital.sub(interest).sub(capitalToRemove);

    uint256 collateralPrice = ftso.getPrice();
    if (remainder != 0) {
      uint256 ratio =
        wdiv(
          wdiv(
            wmul(stakedCollateral.sub(collateralRequested), collateralPrice),
            100
          ),
          remainder
        );
      require(
        ratio >= LIQUIDATION_RATIO,
        "TREASURY: Insufficient collateral provided"
      );
    }
    _;
  }

  /**
   * @dev Ensure that msg.sender === Teller contract address.
   */
  modifier onlyTeller {
    require(msg.sender == registry.getContractAddress(Contract.Teller));
    _;
  }
}
