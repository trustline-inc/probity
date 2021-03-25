// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/DSMath.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IExchange.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/IVault.sol";
import "hardhat/console.sol";

/**
 * @notice Manages equity for all vaults.
 */
contract Treasury is ITreasury, Ownable, ProbityBase, DSMath {
  using SafeMath for uint256;

  // --- Data ---

  uint256 public _totalEquity;
  mapping(address => uint256) public balances; // Normalized Equity

  IAurei public aurei;
  IExchange public exchange;
  IRegistry public registry;
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
    exchange = IExchange(registry.getContractAddress(Contract.Exchange));
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- External Functions ---

  /**
   * @notice Returns the treasury balance of a vault.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    // uint256 rate = exchange.getCumulativeRate();
    // return balances[owner].mul(rate);
    return balances[owner];
  }

  function totalEquity() external view override returns (uint256) {
    return _totalEquity;
  }

  /**
   * @notice Issues equity to caller and adds Aurei to the treasury.
   * @param collateral - Amount of collateral backing the Aurei.
   * @param equity - Amount of Aurei to mint.
   */
  function issue(uint256 collateral, uint256 equity)
    external
    override
    checkEligibility(collateral, equity)
  {
    vault.lock(msg.sender, collateral);
    aurei.mint(address(this), equity);
    balances[msg.sender] = balances[msg.sender].add(equity);
    _totalEquity = _totalEquity.add(equity);
    emit TreasuryUpdated(msg.sender, balances[msg.sender]);
  }

  /**
   * @notice Redeems equity from the treasury, decreasing the Aurei reserves.
   */
  function redeem(uint256 collateral, uint256 equity) external override {
    aurei.burn(address(this), equity);
    balances[msg.sender] = balances[msg.sender].sub(equity);
    _totalEquity = _totalEquity.sub(equity);
    // TODO: Unencumber collateral
    console.log("collateral:", collateral);
    emit TreasuryUpdated(msg.sender, balances[msg.sender]);
  }

  /**
   * @notice Funds a loan using Aurei from the treasury.
   * @param principal - Principal amount of the loan.
   * @param borrower - The address of the borrower.
   */
  function fundLoan(uint256 principal, address borrower)
    external
    override
    onlyTeller
  {
    aurei.transfer(borrower, principal);
  }

  // --- Modifiers ---

  /**
   * @notice Ensures that the owner has sufficient collateral to mint Aurei,
   * and that it meets the minimum collateral ratio requirement.
   * @param collateral - The amount of collateral used to mint Aurei.
   * @param equity - The amount of Aurei.
   */
  modifier checkEligibility(uint256 collateral, uint256 equity) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);
    require(unencumbered >= collateral, "TELL: Collateral not available.");

    // TODO: Hook in collateral price
    uint256 ratio = wdiv(wmul(collateral, 1 ether), equity);
    require(
      ratio >= MIN_COLLATERAL_RATIO,
      "PRO: Insufficient collateral provided"
    );
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
