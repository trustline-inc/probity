// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Base.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/DSMath.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/IVault.sol";
import "hardhat/console.sol";

/**
 * @notice Manages equity for all vaults.
 */
contract Treasury is ITreasury, Ownable, Base, DSMath {
  using SafeMath for uint256;

  // --- Data ---

  uint256 public supply;
  mapping(address => uint256) public equities; // user contribution
  mapping(address => uint256) public balances; // normalized equity

  IAurei public aurei;
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
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- External Functions ---

  /**
   * @notice Returns the capital balance of a vault.
   */
  function balanceOf(address owner) external view override returns (uint256) {
    uint256 accumulator = teller.getScaledAccumulator();
    uint256 capital = wmul(balances[owner], accumulator) / 1e9;
    return capital;
  }

  // @dev TODO: This isn't being used correctly. Maybe better to use aurei.balanceOf(address(this))?
  function totalSupply() external view override returns (uint256) {
    return supply;
  }

  /**
   * @notice Adds capital to the system by minting Aurei to the treasury.
   * @param collateral - Amount of collateral backing the Aurei.
   * @param capital - Amount of Aurei to mint.
   */
  function issue(uint256 collateral, uint256 capital)
    external
    override
    checkIssuanceEligibility(collateral, capital)
  {
    vault.lock(msg.sender, collateral);
    aurei.mint(address(this), capital);
    uint256 accumulator = teller.getAccumulator();
    balances[msg.sender] = add(
      balances[msg.sender],
      rdiv(capital, accumulator)
    );
    supply = supply.add(capital);
    emit TreasuryUpdated(msg.sender, balances[msg.sender]);
  }

  /**
   * @notice Redeems capital from the treasury, decreasing the Aurei reserves.
   * @param collateral - The amount of collateral to redeem
   * @param capital - The amount of capital to redeem
   * @dev This adjusts the capital-collateral ratio
   * @dev TODO: Ensure collateral ratio is maintained.
   */
  function redeem(uint256 collateral, uint256 capital)
    external
    override
    checkRedemptionEligibility(collateral, capital)
  {
    // Reduce capital balance
    balances[msg.sender] = balances[msg.sender].sub(capital);
    supply = supply.sub(capital);

    // Burn the Aurei
    require(
      aurei.balanceOf(address(this)) > capital,
      "TREAS: Not enough reserves."
    );
    aurei.burn(address(this), capital);

    // Unencumber collateral
    vault.unlock(msg.sender, collateral);

    // Emit event
    emit TreasuryUpdated(msg.sender, balances[msg.sender]);
  }

  /**
   * @notice Funds a loan using Aurei from the treasury.
   * @param borrower - The address of the borrower.
   * @param principal - Principal amount of the loan.
   */
  function fundLoan(address borrower, uint256 principal)
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
   * @param capital - The amount of Aurei.
   */
  modifier checkIssuanceEligibility(uint256 collateral, uint256 capital) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);
    require(unencumbered >= collateral, "TREAS: Collateral not available.");

    // TODO: Hook in collateral price
    uint256 ratio = wdiv(wmul(collateral, 1 ether), capital);
    require(
      ratio >= LIQUIDATION_RATIO,
      "TREAS: Insufficient collateral provided"
    );
    _;
  }

  /**
   * @notice Ensures that the owner has sufficient collateral after redemption,
   * and that it meets the minimum collateral ratio requirement.
   * @param requested - The amount of collateral to unlock.
   * @param capital - The amount of Aurei to redeem.
   */
  modifier checkRedemptionEligibility(uint256 requested, uint256 capital) {
    (uint256 total, uint256 encumbered, uint256 unencumbered) =
      vault.get(msg.sender);
    require(encumbered >= requested, "TELL: Collateral not available.");

    // Get current capital balance
    uint256 accumulator = teller.getScaledAccumulator();
    uint256 balance = wmul(balances[msg.sender], accumulator) / 1e9;

    // TODO: Hook in collateral price
    if (balance.sub(capital) != 0) {
      uint256 ratio =
        wdiv(wmul(encumbered.sub(requested), 1 ether), balance.sub(capital));
      require(
        ratio >= LIQUIDATION_RATIO,
        "TREAS: Insufficient collateral provided"
      );
    }
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
