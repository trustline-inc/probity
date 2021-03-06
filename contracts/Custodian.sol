// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Interfaces/ICustodian.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IRegistry.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/SafeMath.sol";

/**
 * @notice The custodian manages collateral vaults.
 *
 * Adapted from https://github.com/liquity/beta/blob/main/contracts/Interfaces/ITroveManager.sol
 */
contract Custodian is ICustodian, ProbityBase, Ownable {
  using SafeMath for uint256;

  // --- Data ---

  ITreasury public treasury;
  IRegistry public registry;

  mapping(address => Vault) public vaults;

  uint256 private nonce;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {}

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
  }

  // --- External Functions ---

  /**
   * @notice Creates a new vault to store collateral.
   * @param owner - Address of the vault owner.
   * @param initialCollateral - Initial collateral amount.
   * @return index - Vault ID
   */
  function createVault(address owner, uint256 initialCollateral)
    external
    override
    returns (uint256 index)
  {
    vaults[owner].collateral = initialCollateral;
    vaults[owner].status = Status.Active;

    // Set vault ID
    index = nonce + 1;
    nonce = index;

    emit VaultCreated(owner, index);
    return index;
  }

  /**
   * @notice Fetches vault details.
   * @param _owner - Vault owner address.
   * @return The vault data structure.
   */
  function getVaultByOwner(address _owner)
    external
    view
    override
    returns (Vault memory)
  {
    return (vaults[_owner]);
  }

  /**
   * @notice Ensuring that the borrower has sufficient collateral for a new loan.
   * @param debt - The amount of Aurei borrowed.
   * @param borrower - Address of the borrower.
   * @dev Check collateral in use by any equity or debt positions
   */
  function checkBorrowerEligibility(uint256 debt, address borrower)
    external
    view
    override
  {
    Vault memory vault = this.getVaultByOwner(borrower);
    uint256 equity = treasury.balanceOf(borrower);
    this.requireSufficientCollateral(debt, equity, vault.collateral);
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
  ) external pure override {
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
