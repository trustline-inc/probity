// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ITreasury.sol";
import "./Interfaces/IProbity.sol";
import "./Interfaces/IVaultManager.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice This is the main contract which calls other contracts for specific sets of business logic.
 */
contract Probity is IProbity, Ownable, ProbityBase {

  // --- Data ---

  ITreasury public treasury;
  IVaultManager public vaultManager;

  // --- Constructor ---

  /**
   * @notice Sets the addresses of deployed modules.
   */
  constructor(address _treasury, address _vaultManager) Ownable(msg.sender) {
    treasury = ITreasury(_treasury);
    vaultManager = IVaultManager(_vaultManager);
  }

  // --- External Functions ---

  /**
   * @notice Opens a vault, deposits collateral, and mints Aurei for lending. 
   * @param debt - The amount of Aurei to borrow.
   * @param equity - The amount of Aurei to mint for lending.
   * @return vaultId
   * @dev Requires sufficient collateralization before opening vault.
   */
  function openVault(uint debt, uint equity) external payable override hasSufficientCollateral(debt, equity) returns (uint vaultId) {
    vaultId = vaultManager.createVault(msg.sender, msg.value);

    if (equity > 0) treasury.increase(equity, vaultId);
    // TODO:
    // if (debt > 0) teller.createLoan(debt, vaultId);

    return vaultId;
  }

  /**
   * @notice Grants `grantee` access to the vault.
   * @param vaultId - The vault to grant access to.
   * @param grantee - Address of the grantee.
   */
  function grantVaultAccess(uint vaultId, address grantee) external override returns (bool result) {

  }

  /**
   * @notice Adds collateral to an existing vault and adds Aurei to the treasury.
   * @param vaultId - The vault to add collateral to.
   * @dev Caller MUST be the owner of the vault.
   */
  function addCollateral(uint vaultId) external payable override {

  }

  /**
   * @notice Transfers collateral from the vault to the caller.
   * @param vaultId - The vault to withdraw from.
   * @param amount - The amount of collateral to withdraw.
   * @dev Caller MUST be the owner of the vault. New collateral ratio MUST be
   * greater than the minimum collateral ratio.
   */
  function withdrawCollateral(uint vaultId, uint amount) external override {

  }

  /**
   * @notice Closes a vault, transferring all collateral to the caller.
   * @param vaultId - The vault to withdraw from.
   */
  function closeVault(uint vaultId) external override {

  }

  // --- Modifiers ---

  modifier hasSufficientCollateral(uint debt, uint equity) {
    uint collateralRatio = msg.value / (debt + equity);
    require(collateralRatio > MIN_COLLATERAL_RATIO);
    _;
  }

}
