// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface IAurei is IERC20, IERC2612 {
  // --- Events ---
  event AureiBalanceUpdated(address _user, uint _amount);
  event VaultManagerAddressChanged(address _vaultManagerAddress);
  event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
  event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

  // --- Functions ---
  function mint(address _account, uint256 _amount) external;
  function burn(address _account, uint256 _amount) external;
}