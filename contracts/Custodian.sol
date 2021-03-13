// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Interfaces/ICustodian.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IRegistry.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/SafeMath.sol";
import "hardhat/console.sol";

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

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

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
    require(vaults[owner].index == 0, "CUST: Vault already exists");

    // Set vault ID
    index = nonce + 1;
    nonce = index;
    vaults[owner].index = index;

    vaults[owner].collateral = initialCollateral;
    vaults[owner].encumbered = 0;
    vaults[owner].status = Status.Active;

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
   * @notice Increases the collateral amount in vault
   * @param _owner vault owner address
   * @param amount collateral amount
   */
  function increaseCollateral(address _owner, uint256 amount)
    external
    override
  {
    vaults[_owner].collateral = vaults[_owner].collateral.add(amount);
  }

  /**
   * @notice Decreases the collateral amount in vault
   * @param _owner vault owner address
   * @param amount collateral amount
   */
  function decreaseCollateral(address _owner, uint256 amount)
    external
    override
  {
    vaults[_owner].collateral = vaults[_owner].collateral.sub(amount);
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
    Vault memory vault = vaults[borrower];
    uint256 equity = treasury.balanceOf(borrower);
    this.requireSufficientCollateral(debt, equity, vault.collateral);
  }

  function lockCollateral(uint256 amount, address owner) external override {
    vaults[owner].encumbered = vaults[owner].encumbered.add(amount);
  }

  /**
   * @param debt - The amount of Aurei to be borrowed.
   * @param equity - The amount of Aurei to lend.
   * @param unencumbered - The amount of unencumbered collateral.
   * @dev Solidity does not have floating point division.
   *
   * EXAMPLE:
   *   msg.value = 150 * 10^18 (in wei, assume price = $1)
   *   collateral = 150 * 10^18 * 10^9 (ray) = 150 * 10^27 (ray)
   *   debt + equity = 0 + 100 (e.g. $100 of equity) = 100 * 10^18 (wad)
   *   150 * 10^27 / 100 * 10^18 = (150/100) * 10^9 => 1.5 * 10^9 = 1500000000 (wei)
   *   ray(1.5 * 10^9) = 1.5 * 10^18 (MIN_COLLATERAL_RATIO)
   */
  function requireSufficientCollateral(
    uint256 debt,
    uint256 equity,
    uint256 unencumbered
  ) external pure override {
    // Check for infinity division - E.G., if user doesn't want lending or borrowing.
    // User may open vault with collateral without utilizing the position.
    if ((debt + equity) > 0) {
      uint256 collateralRatio =
        ray((ray(unencumbered).mul(1)).div((debt + equity)));
      require(
        collateralRatio >= MIN_COLLATERAL_RATIO,
        "PRO: Insufficient collateral provided"
      );
    }
  }
}
