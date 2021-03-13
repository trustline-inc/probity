// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ICustodian.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IProbity.sol";
import "./Interfaces/IRegistry.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/Ownable.sol";
import "hardhat/console.sol";

/**
 * @notice This is the main contract which calls other contracts for specific sets of business logic.
 */
contract Probity is IProbity, Ownable, ProbityBase {
  using SafeMath for uint256;

  // --- Data ---

  ICustodian public custodian;
  ITeller public teller;
  ITreasury public treasury;
  IRegistry public registry;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    custodian = ICustodian(registry.getContractAddress(Contract.Custodian));
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
  }

  // --- External Functions ---

  /**
   * @notice Opens a vault, deposits collateral, and mints Aurei for lending.
   * @param equity - The amount of Aurei to mint for lending.
   * @return vaultId
   * @dev Requires sufficient collateralization before opening vault.
   */
  function openVault(uint256 debt, uint256 equity)
    public
    payable
    override
    returns (uint256 vaultId)
  {
    vaultId = custodian.createVault(msg.sender, msg.value);
    if (equity > 0) {
      custodian.requireSufficientCollateral(debt, equity, msg.value);
      custodian.lockCollateral(msg.value, msg.sender); // TODO: TEST THIS.
      treasury.increase(equity, msg.sender);
    }
    emit VaultCreated(msg.sender, vaultId, msg.value);
    return vaultId;
  }

  /**
   * @notice Adds collateral to an existing vault and adds Aurei to the treasury.
   * @param equity - Amount of Aurei to place in reserves for lending.
   */
  function addCollateral(uint256 equity) external payable override {
    custodian.increaseCollateral(msg.sender, msg.value);
    if (equity > 0) {
      custodian.requireSufficientCollateral(0, equity, msg.value);
      treasury.increase(equity, msg.sender);
    }
  }

  /**
   * @notice Increases a vault's equity balance
   * @param _collateral - The amount of collateral backing the Aurei.
   * @param equity - Amount of Aurei to place in reserves for lending.
   */
  function increaseEquity(uint256 _collateral, uint256 equity) external {
    require(equity > 0);
    ProbityBase.Vault memory vault = custodian.getVaultByOwner(msg.sender);
    uint256 unencumbered = vault.collateral.sub(vault.encumbered);
    custodian.requireSufficientCollateral(0, equity, unencumbered);
    custodian.lockCollateral(_collateral, msg.sender);
    treasury.increase(equity, msg.sender);
  }

  /**
   * @notice Gets the vault details.
   * @return The user's vault.
   */
  function getVault() external view override returns (Vault memory) {
    return custodian.getVaultByOwner(msg.sender);
  }

  /**
   * @notice Transfers collateral from the vault to the caller.
   * @param amount - The amount of collateral to withdraw.
   * @dev Caller MUST be the owner of the vault. New collateral ratio MUST be
   * greater than the minimum collateral ratio.
   * @dev https://docs.soliditylang.org/en/v0.4.24/common-patterns.html#withdrawal-from-contracts
   */
  function withdrawCollateral(uint256 amount) external override {
    // TODO: Check if the collateral ratio is maintained
    // TODO: Check interest due
    // TODO: Check encumbered collateral
    // ProbityBase.Vault memory vault = custodian.getVaultByOwner(msg.sender);
    custodian.decreaseCollateral(msg.sender, amount);
    payable(msg.sender).transfer(amount);
  }

  /**
   * @notice Withdraws equity from the treasury to the caller.
   * @param amount - The amount of equity to withdraw.
   */
  function withdrawEquity(uint256 amount) external {
    treasury.withdrawEquity(msg.sender, amount);
  }

  /**
   * @notice Closes a vault, transferring all collateral to the caller.
   */
  function closeVault() external override {}
}
