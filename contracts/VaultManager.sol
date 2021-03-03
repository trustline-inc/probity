// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IVaultManager.sol";
import "./Interfaces/IAurei.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/SafeMath.sol";

/**
 * @notice A vault is used to store collateral.
 *
 * Adapted from https://github.com/liquity/beta/blob/main/contracts/Interfaces/ITroveManager.sol
 */
contract VaultManager is IVaultManager, Ownable {
  using SafeMath for uint256;

  // --- Data ---

  enum Status {
    Active,
    Closed,
    NonExistent
  }

  struct Vault {
    uint debt;
    uint collateral;
    uint arrayIndex;
    Status status;
  }

  mapping (address => Vault) public vaults;

  address[] public vaultOwners;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {
    
  }

  // --- External Functions ---

  function openVault(address owner, uint initalCollateral) external payable override returns (uint index) {
    vaults[owner].debt = 0;
    vaults[owner].collateral = initalCollateral;

    _setVaultStatus(owner, Status.Active);

    index = _addVaultOwnerToArray(owner);

    emit VaultCreated(owner, index);

    return index;
  }

  // --- Internal Functions ---

  function _addVaultOwnerToArray(address _owner) internal returns (uint _index) {
    vaultOwners.push(_owner);
    _index = vaultOwners.length.sub(1);
    vaults[_owner].arrayIndex = _index;
    return _index;    
  }

  function _setVaultStatus(address owner, Status status) internal {
    vaults[owner].status = status;
  }
}
