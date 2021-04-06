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

  struct State {
    uint256 total;
    uint256 encumbered;
    uint256 unencumbered;
  }

  ITeller public teller;
  ITreasury public treasury;
  IRegistry public registry;

  uint256 public _totalEncumbered;
  uint256 public _debtEncumbered;
  uint256 public _equityEncumbered;

  mapping(address => State) public vaults;

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
  function get(address owner)
    external
    view
    override
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    State memory vault = vaults[owner];
    return (vault.total, vault.encumbered, vault.unencumbered);
  }

  /**
   * @notice Gets the total amount of locked collateral.
   * @return The amount of locked collateral.
   */
  function totalEncumbered() external view override returns (uint256) {
    return _totalEncumbered;
  }

  function debtEncumbered() external view override returns (uint256) {
    return _debtEncumbered;
  }

  function equityEncumbered() external view override returns (uint256) {
    return _equityEncumbered;
  }

  /**
   * @notice Deposits collateral to a vault.
   */
  function deposit() external payable override {
    State storage vault = vaults[msg.sender];
    vault.total = vaults[msg.sender].total.add(msg.value);
    vault.unencumbered = vault.unencumbered.add(msg.value);
    emit VaultUpdated(
      msg.sender,
      vault.total,
      vault.encumbered,
      vault.encumbered
    );
  }

  /**
   * @notice Withdraws unencumbered collateral from the vault.
   * @param amount - The amount of collateral to withdraw.
   * @dev https://docs.soliditylang.org/en/v0.4.24/common-patterns.html#withdrawal-from-contracts
   */
  function withdraw(uint256 amount) external override {
    State storage vault = vaults[msg.sender];
    require(
      amount <= vault.total - vault.encumbered,
      "CUST: Overdraft not allowed."
    );
    vault.total = vault.total.sub(amount);
    vault.unencumbered = vault.unencumbered.sub(amount);
    payable(msg.sender).transfer(amount);
    emit VaultUpdated(
      msg.sender,
      vault.total,
      vault.encumbered,
      vault.unencumbered
    );
  }

  /**
   * @notice Encumbers collateral.
   * @dev Only called by Teller or Treasury contracts.
   */
  function lock(address owner, uint256 amount)
    external
    override
    onlyTellerOrTreasury
  {
    State storage vault = vaults[owner];
    vault.encumbered = vault.encumbered.add(amount);
    vault.unencumbered = vault.unencumbered.sub(amount);
    _totalEncumbered = _totalEncumbered.add(amount);

    if (msg.sender == address(teller)) {
      _debtEncumbered = _debtEncumbered.add(amount);
    }

    if (msg.sender == address(treasury)) {
      _equityEncumbered = _equityEncumbered.add(amount);
    }

    emit VaultUpdated(owner, vault.total, vault.encumbered, vault.unencumbered);
  }

  /**
   * @notice Unencumbers collateral.
   * @dev Only called by Teller or Treasury contracts.
   */
  function unlock(address owner, uint256 amount)
    external
    override
    onlyTellerOrTreasury
  {
    State storage vault = vaults[owner];
    vault.encumbered = vault.encumbered.sub(amount);
    vault.unencumbered = vault.unencumbered.add(amount);
    _totalEncumbered = _totalEncumbered.sub(amount);

    if (msg.sender == address(teller)) {
      _debtEncumbered = _debtEncumbered.sub(amount);
    }

    if (msg.sender == address(treasury)) {
      _equityEncumbered = _equityEncumbered.sub(amount);
    }

    emit VaultUpdated(owner, vault.total, vault.encumbered, vault.unencumbered);
  }

  // --- Modifiers ---

  /**
   * @notice Ensures that the modified function is being called by Teller or Treasury.
   */
  modifier onlyTellerOrTreasury() {
    require(
      msg.sender == address(teller) || msg.sender == address(treasury),
      "CUST: Invalid caller."
    );
    _;
  }
}
