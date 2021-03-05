// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IProbity.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IRegistry.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Treasury is ITreasury, Ownable, ProbityBase {
  using SafeMath for uint256;

  // --- Data ---

  mapping(address => uint256) public balances;

  IAurei public aurei;
  IProbity public probity;
  IRegistry public registry;

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
    probity = IProbity(registry.getContractAddress(Contract.Treasury));
  }

  // --- External Functions ---

  /**
   * @notice Returns the treasury balance of a vault.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    return balances[owner];
  }

  /**
   * @notice Adds Aurei to the treasury.
   * @dev Only callable by Probity
   */
  function increase(uint256 amount, address owner)
    external
    override
    onlyProbity
  {
    aurei.mint(address(this), amount);
    balances[owner] = balances[owner].add(amount);
    emit TreasuryIncrease(owner, amount);
  }

  /**
   * @notice Removes Aurei from the treasury.
   * @dev Only callable by Probity
   * check if owner has enough balances.
   */
  function decrease(uint256 amount, address owner)
    external
    override
    onlyProbity
    checkBalance(amount, owner)
  {
    aurei.burn(address(this), amount);
    balances[owner] = balances[owner].sub(amount);
    emit TreasuryDecrease(owner, amount);
  }

  /**
   * @notice Transfers Aurei owned by the treasury to the borrower.
   * @param borrower - The address of the borrower.
   */
  function transfer(address borrower, uint256 amount)
    external
    override
    onlyTeller
  {
    aurei.transfer(borrower, amount);
  }

  /**
   * @notice Reduces equity balance for lender and Transfers Aurei owned by the treasury to the borrower.
   * @param lender - The address of the lender.
   * @param borrower - The address of the borrower.
   * @param amount - Amount to transfer.
   */
  function transferEquity(
    address lender,
    address borrower,
    uint256 amount
  ) external override onlyTeller checkBalance(amount, lender) {
    balances[lender] = balances[lender].sub(amount);
    aurei.transfer(borrower, amount);
    emit TreasuryDecrease(lender, amount);
  }

  // --- Modifiers ---

  /**
   * @dev Ensure that msg.sender === Probity contract address.
   */
  modifier onlyProbity {
    require(msg.sender == registry.getContractAddress(Contract.Probity));
    _;
  }

  /**
   * @dev Ensure that msg.sender === Teller contract address.
   */
  modifier onlyTeller {
    require(msg.sender == registry.getContractAddress(Contract.Teller));
    _;
  }

  /*
   * @dev Check if user has enough balances
   * @param amount - Amount to lend
   * @param lender - Address of lender
   */
  modifier checkBalance(uint256 amount, address lender) {
    require(balances[lender] >= amount, "TREASURY: Insufficient balance.");
    _;
  }
}
