// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Interfaces/ICustodian.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/SafeMath.sol";

/**
 * @notice A vault is used to store collateral.
 *
 * Adapted from https://github.com/liquity/beta/blob/main/contracts/Interfaces/ITroveManager.sol
 */
contract Custodian is ICustodian, ProbityBase, Ownable {
  using SafeMath for uint256;

  // --- Data ---

  mapping(address => Vault) public vaults;

  address[] public vaultOwners;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {}

  // --- External Functions ---

  /**
   * @notice Creates a new vault to store collateral.
   * @param owner - Address of the vault owner.
   * @param initialCollateral - Initial collateral amount.
   */
  function createVault(address owner, uint256 initialCollateral)
    external
    override
    returns (uint256 index)
  {
    vaults[owner].collateral = initialCollateral;
    setVaultStatus(owner, Status.Active);
    index = addVaultOwnerToArray(owner);
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

  // --- Internal Functions ---

  function addVaultOwnerToArray(address owner)
    internal
    returns (uint256 index)
  {
    vaultOwners.push(owner);
    index = vaultOwners.length.sub(1);
    vaults[owner].index = index;
    return index;
  }

  function setVaultStatus(address owner, Status status) internal {
    vaults[owner].status = status;
  }
}
