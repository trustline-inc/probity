// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IVault.sol";
import "./Interfaces/IRegistry.sol";
import "hardhat/console.sol";

/**
 * @notice Manages vault collateral.
 *
 */
contract Vault is IVault, Base, Ownable {
  using SafeMath for uint256;

  // --- Data ---

  struct Collateral {
    uint256 loanCollateral;
    uint256 stakedCollateral;
  }

  ITeller public teller;
  ITreasury public treasury;
  IRegistry public registry;

  // Aggregate collateral amounts
  uint256 public _totalCollateral;
  uint256 public _totalLoanCollateral;
  uint256 public _totalStakedCollateral;

  mapping(address => Collateral) public vaults;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Set the address of a dependent contract.
   */
  function initializeContract() external onlyOwner {
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
  }

  // --- External Functions ---

  /**
   * @notice Fetches vault details.
   * @return The vault data structure.
   */
  function balanceOf(address owner)
    external
    view
    override
    returns (uint256, uint256)
  {
    Collateral memory balances = vaults[owner];
    return (balances.loanCollateral, balances.stakedCollateral);
  }

  /**
   * @notice Gets the aggregate amount of loan collateral.
   * @return The amount of loan collateral.
   */
  function totalLoanCollateral() external view override returns (uint256) {
    return _totalLoanCollateral;
  }

  /**
   * @notice Gets the aggregate amount of collateral for capital.
   * @return The amount of locked collateral for capital.
   */
  function totalStakedCollateral() external view override returns (uint256) {
    return _totalStakedCollateral;
  }

  /**
   * @notice Deposits collateral to a vault.
   */
  function deposit(Activity activity, address owner)
    external
    payable
    override
    onlyTellerOrTreasury
  {
    require(
      activity == Activity.Borrow || activity == Activity.Stake,
      "VAULT: Invalid activity for deposit."
    );
    Collateral storage balances = vaults[owner];

    if (activity == Activity.Borrow) {
      balances.loanCollateral = vaults[owner].loanCollateral.add(msg.value);
      _totalLoanCollateral = _totalLoanCollateral.add(msg.value);
    }

    if (activity == Activity.Stake) {
      balances.stakedCollateral = vaults[owner].stakedCollateral.add(msg.value);
      _totalStakedCollateral = _totalStakedCollateral.add(msg.value);
    }

    emit VaultUpdated(
      owner,
      balances.loanCollateral,
      balances.stakedCollateral
    );
  }

  /**
   * @notice Withdraws available collateral from the vault.
   * @param amount - The amount of collateral to withdraw.
   * @dev https://docs.soliditylang.org/en/v0.4.24/common-patterns.html#withdrawal-from-contracts
   */
  function withdraw(
    Activity activity,
    address owner,
    address recipient,
    uint256 amount
  ) external override onlyTellerOrTreasury {
    require(
      activity == Activity.Repay ||
        activity == Activity.Redeem ||
        activity == Activity.LiquidateLoan ||
        activity == Activity.LiquidateStake,
      "VAULT: Invalid activity for withdrawal."
    );
    Collateral storage balances = vaults[owner];

    if (activity == Activity.Repay) {
      require(
        amount <= balances.loanCollateral,
        "VAULT: Overdraft not allowed."
      );
      balances.loanCollateral = vaults[owner].loanCollateral.sub(amount);
      _totalLoanCollateral = _totalLoanCollateral.sub(amount);
      payable(recipient).transfer(amount);
    }

    if (activity == Activity.Redeem) {
      require(
        amount <= balances.stakedCollateral,
        "VAULT: Overdraft not allowed."
      );
      balances.stakedCollateral = vaults[owner].stakedCollateral.sub(amount);
      _totalStakedCollateral = _totalStakedCollateral.sub(amount);
      payable(recipient).transfer(amount);
    }

    if (activity == Activity.LiquidateLoan) {
      balances.loanCollateral = vaults[owner].loanCollateral.sub(amount);
      _totalLoanCollateral = _totalLoanCollateral.sub(amount);
      payable(recipient).transfer(amount);
    }

    if (activity == Activity.LiquidateStake) {
      balances.stakedCollateral = vaults[owner].stakedCollateral.sub(amount);
      _totalStakedCollateral = _totalStakedCollateral.sub(amount);
      payable(recipient).transfer(amount);
    }

    emit VaultUpdated(
      owner,
      balances.loanCollateral,
      balances.stakedCollateral
    );
  }

  // --- Modifiers ---

  /**
   * @notice Ensures that the modified function is being called by Teller or Treasury.
   */
  modifier onlyTellerOrTreasury() {
    require(
      msg.sender == address(teller) || msg.sender == address(treasury),
      "VAULT: Invalid caller."
    );
    _;
  }
}
