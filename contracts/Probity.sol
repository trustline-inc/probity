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
   * @param debt - The amount of Aurei to borrow.
   * @param equity - The amount of Aurei to mint for lending.
   * @return vaultId
   * @dev Requires sufficient collateralization before opening vault.
   */
  function openVault(uint256 debt, uint256 equity)
    external
    payable
    override
    returns (uint256 vaultId)
  {
    vaultId = custodian.createVault(msg.sender, msg.value);
    if (equity > 0) {
      requireSufficientCollateral(debt, equity, msg.value);
      treasury.increase(equity, msg.sender);
    }
    emit VaultCreated(msg.sender, vaultId);
    return vaultId;
  }

  /**
   * @notice Adds collateral to an existing vault and adds Aurei to the treasury.
   * @dev Caller MUST be the owner of the vault.
   */
  function addCollateral() external payable override {}

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
   */
  function withdrawCollateral(uint256 amount) external override {
    // 1. Check if the collateral ratio is maintained
    // TODO: Check interest
    ProbityBase.Vault memory vault = custodian.getVaultByOwner(msg.sender);

    uint256 equity = treasury.balanceOf(msg.sender);
  }

  /**
   * @notice Closes a vault, transferring all collateral to the caller.
   */
  function closeVault() external override {}

  /**
   * @param debt - The amount of Aurei borrowed.
   * @param borrower - Address of the borrower.
   */
  function checkBorrowerEligibility(uint256 debt, address borrower)
    external
    view
    override
  {
    Vault memory vault = custodian.getVaultByOwner(borrower);
    uint256 equity = treasury.balanceOf(borrower);
    requireSufficientCollateral(debt, equity, vault.collateral);
  }

  /**
   * @param debt - The amount of Aurei to be borrowed.
   * @param equity - The amount of Aurei to lend.
   * @param collateral - Amount for collateral.
   * @dev Solidity does not have floating point division.
   *
   * EXAMPLE:
   *   msg.value = 150 x 10^18 (assume price = $1)
   *   debt + equity = 1 x 10^2 (e.g. $100 of debt and/or equity)
   *   150 x 10^18 / 100 = 150 * 10^16
   *   (150 * 10^16) / 1 x 10^18 = 1.5 or 150%
   */
  function requireSufficientCollateral(
    uint256 debt,
    uint256 equity,
    uint256 collateral
  ) internal pure {
    // Check for infinity division - E.G., if user doesn't want lending or borrowing.
    // User may open vault with collateral without utilizing the position.
    if ((debt + equity) > 0) {
      uint256 collateralRatio = collateral.div((debt + equity));
      require(
        collateralRatio >= MIN_COLLATERAL_RATIO,
        "PRO: Insufficient collateral provided"
      );
    }
  }
}
