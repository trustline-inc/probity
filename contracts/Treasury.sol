// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ITreasury.sol";
import "./Interfaces/IAurei.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Treasury is ITreasury, Ownable {

  // --- Data ---

  mapping (uint => uint) public balances;

  IAurei public aurei;

  // --- Constructor ---

  constructor(address _aurei) Ownable(msg.sender) {
    aurei = IAurei(_aurei);
  }

  // --- External Functions ---

  /**
   * @notice Returns the treasury balance of a vault.
   */
	function balanceOf(uint vaultId) external view override returns (uint256) {
		return balances[vaultId];
	}

  /**
   * @notice Mint tokens to the treasury.
	 * @dev Only callable by Probity
	 */
  function mint(uint256 amount, uint vaultId) external override onlyOwner {
    aurei.mint(address(this), amount);
    balances[vaultId] = balances[vaultId] + amount;
  }

  /**
   * @notice Burn tokens from the treasury.
	 * @dev Only callable by Probity
	 */
  function burn(uint256 amount, uint vaultId) external override onlyOwner {
    aurei.burn(address(this), amount);
    balances[vaultId] = balances[vaultId] - amount;
  }

}
