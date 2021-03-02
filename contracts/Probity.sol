// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IProbity.sol";
import "./Interfaces/IVaultManager.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice This is the main contract which calls other contracts for specific sets of business logic.
 */
contract Probity is IProbity, Ownable {

  // --- Data ---

  IVaultManager public vaultManager;

  // --- Contructor ---

  /**
   * @notice Sets the addresses of deployed modules.
   */
  constructor(address _vaultManager) {
    vaultManager = IVaultManager(_vaultManager);
  }

  // --- External Functions ---

  function openVault() external payable override returns (uint vaultId) {
    vaultId = vaultManager.openVault(msg.sender, msg.value);
    return vaultId;
  }

  function grantVaultAccess(uint _vaultId, address _grantee) external override returns (bool result) {

  }

  function addCollateral(uint _vaultId) external payable override {

  }

  function withdrawCollateral(uint _vaultId, uint _amount) external override {

  }

  function closeVault(uint _vaultId) external override {

  }

}