// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";
/**
 * @notice Common interface for the Aurei token.
 */
interface IAurei is IERC20, IERC2612 {
  // --- Events ---

  event AureiBalanceUpdated(address _user, uint _amount);
  event VaultManagerAddressChanged(address _vaultManagerAddress);

  // --- Functions ---

  function mint(uint256 _amount) external;
  function burn(uint256 _amount) external;
}
