// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IProbity.sol";
import "./Interfaces/IVaultManager.sol";
import "./Interfaces/IRegistry.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/Ownable.sol";
import "hardhat/console.sol";

/**
 * @notice This is the main contract which calls other contracts for specific sets of business logic.
 */
contract Probity is IProbity, Ownable, ProbityBase {
  using SafeMath for uint;

  // --- Data ---

  ITeller public teller;
  ITreasury public treasury;
  IVaultManager public vaultManager;
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
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    vaultManager = IVaultManager(registry.getContractAddress(Contract.VaultManager));
  }
  // --- External Functions ---

  /**
   * @notice Opens a vault, deposits collateral, and mints Aurei for lending. 
   * @param debt - The amount of Aurei to borrow.
   * @param equity - The amount of Aurei to mint for lending.
   * @return vaultId
   * @dev Requires sufficient collateralization before opening vault.
   */
  function openVault(uint debt, uint equity) external payable override hasSufficientCollateral(debt, equity) returns (uint256 vaultId) {
    vaultId = vaultManager.createVault(msg.sender, msg.value);

    if (equity > 0) treasury.increase(equity, vaultId);
    // if (debt > 0) teller.createLoan(debt, vaultId);
    emit VaultCreated(msg.sender, vaultId);
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
   * @notice Gets collateral details from the vault
   * @param _owner - Vault owner address
   * Returns collateral amount, vaultIndex.
   */
  function getCollateralDetails(address _owner) external view override returns (Vault memory) {
      return vaultManager.getVaultOwnerDetails(_owner);
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

  /**
   * @param debt - The amount of Aurei to be borrowed.
   * @param equity - The amount of Aurei to lend.
   * @dev Solidity does not have floating point division.
   * Scenario: If user doesn't want lending or borrowing. Just doing collateral, is allowed?
   * EXAMPLE:
   *   msg.value = 150 x 10^18
   *   debt + equity = 1 x 10^2
   *   150 x 10^18 / 100 = 150 * 10^16 = 1.5
   */
  modifier hasSufficientCollateral(uint debt, uint equity) {
    //Check for infinity division 
    if ((debt + equity) > 0)  { 
       uint collateralRatio = msg.value.div((debt + equity));
      require((collateralRatio) >= MIN_COLLATERAL_RATIO, "PRO: Insufficient collateral provided");
    }  
    _;
  }
}
