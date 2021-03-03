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
   * @param amount - The desired amount of Aurei to mint.
   * @return vaultId
   * @dev Requires sufficient collateralization before opening vault.
   */
  function openVault(uint amount) external payable override hasSufficientCollateral(amount) returns (uint vaultId) {
    vaultId = vaultManager.openVault(msg.sender, msg.value);
    treasury.mint(amount, vaultId);
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

  // --- Modifiers ---
  modifier hasSufficientCollateral(uint amount) {
    uint collateralRatio = msg.value / amount;
    require(collateralRatio > MIN_COLLATERAL_RATIO);
    _;
  }

}
