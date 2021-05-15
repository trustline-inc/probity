// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/DSMath.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
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
  IRegistry public registry;
  ITcnToken public tcnToken;
  ITeller public teller;
  IVault public vault;

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
    tcnToken = ITcnToken(registry.getContractAddress(Contract.TcnToken));
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- External Functions ---

  /**
   * @notice Returns the capital balance of a vault.
   */
  function capitalOf(address owner) external view override returns (uint256) {
    uint256 accumulator = teller.getScaledAccumulator();
    uint256 capital = wmul(normalizedCapital[owner], accumulator) / 1e9;
    return capital;
  }

  /**
   * @notice Returns the interest balance of a vault.
   */
  function interestOf(address owner) external view override returns (uint256) {
    uint256 accumulator = teller.getScaledAccumulator();
    uint256 capital = wmul(normalizedCapital[owner], accumulator) / 1e9;
    uint256 interest = capital - initialCapital[owner];
    return interest;
  }

  /**
   * @notice Adds capital to the system by minting Aurei to the treasury.
   * @param collateral - Amount of collateral backing the Aurei.
   * @param capital - Amount of Aurei to mint.
   */
  function issue(uint256 collateral, uint256 capital)
    external
    override
    checkIssuanceEligibility(collateral, capital)
  {
    vault.lock(msg.sender, collateral);
    aurei.mint(address(this), capital);
    uint256 accumulator = teller.getAccumulator();
    normalizedCapital[msg.sender] = add(
      normalizedCapital[msg.sender],
      rdiv(capital, accumulator)
    );
    initialCapital[msg.sender] = initialCapital[msg.sender].add(capital);
    _totalSupply = _totalSupply.add(capital);
    teller.updateRate(0, Activity.Stake);
    emit TreasuryUpdated(msg.sender, collateral, capital);
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
    // Reduce capital balance
    uint256 accumulator = teller.getAccumulator();
    normalizedCapital[msg.sender] = sub(
      normalizedCapital[msg.sender],
      rdiv(capital, accumulator)
    );
    initialCapital[msg.sender] = initialCapital[msg.sender].sub(capital);
    _totalSupply = _totalSupply.sub(capital);

    // Burn the Aurei
    require(
      aurei.balanceOf(address(this)) > capital,
      "TREASURY: Not enough reserves."
    );
    aurei.burn(address(this), capital);

    // Unencumber collateral
    vault.unlock(msg.sender, collateral);

    teller.updateRate(0, Activity.Redeem);

    // Emit event
    emit TreasuryUpdated(msg.sender, collateral, capital);
  }

  /**
   * @notice Withdraws TCN from the vault.
   * @param amount - The amount of TCN to withdraw.
   * @dev https://docs.soliditylang.org/en/v0.4.24/common-patterns.html#withdrawal-from-contracts
   */
  function withdraw(uint256 amount, bool tcn) external override {
    // Calculate withdrawable TCN
    uint256 accumulator = teller.getScaledAccumulator();
    uint256 capital = wmul(normalizedCapital[msg.sender], accumulator) / 1e9;
    uint256 interest = capital - initialCapital[msg.sender];
    require(amount <= interest, "TREASURY: Insufficient interest balance");

    // Reduce capital
    // initialCapital[msg.sender] = capital.sub(amount);
    normalizedCapital[msg.sender] = sub(
      normalizedCapital[msg.sender],
      rdiv(amount, accumulator)
    );

    if (tcn) {
      // Burn AUR and mint TCN to caller
      aurei.burn(address(this), amount);
      tcnToken.mint(msg.sender, amount);
    } else {
      aurei.transferFrom(address(this), msg.sender, amount);
    }

    teller.updateRate(0, Activity.Withdraw);

    // Emit event
    emit TreasuryUpdated(msg.sender, 0, capital);
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
   * @return Total AUR capital
   */
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  // --- Modifiers ---

  /**
   * @notice Ensures that the owner has sufficient collateral to mint Aurei,
   * and that it meets the minimum collateral ratio requirement.
   * @param collateral - The amount of collateral used to mint Aurei.
   * @param capital - The amount of Aurei.
   */
  modifier checkIssuanceEligibility(uint256 collateral, uint256 capital) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);
    require(unencumbered >= collateral, "TREASURY: Collateral not available.");

    // TODO: Hook in collateral price
    uint256 ratio = wdiv(wmul(collateral, 1 ether), capital);
    require(
      ratio >= LIQUIDATION_RATIO,
      "TREASURY: Insufficient collateral provided"
    );
    _;
  }

  /**
   * @notice Ensures that the owner has sufficient collateral after redemption,
   * and that it meets the minimum collateral ratio requirement.
   * @param requested - The amount of collateral to unlock.
   * @param capital - The amount of Aurei to redeem.
   */
  modifier checkRedemptionEligibility(uint256 requested, uint256 capital) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);
    require(encumbered >= requested, "TREASURY: Collateral not available.");

    // Get current capital balance
    uint256 accumulator = teller.getScaledAccumulator();
    uint256 balance = wmul(normalizedCapital[msg.sender], accumulator) / 1e9;

    // TODO: Hook in collateral price
    if (balance.sub(capital) != 0) {
      uint256 ratio =
        wdiv(wmul(encumbered.sub(requested), 1 ether), balance.sub(capital));
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
