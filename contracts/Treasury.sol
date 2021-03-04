// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/ITreasury.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Treasury is ITreasury, Ownable {
  using SafeMath for uint256;

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
   * @notice Adds Aurei to the treasury.
	 * @dev Only callable by Probity
	 */
  function increase(uint256 amount, uint vaultId) external override onlyOwner {
    aurei.mint(address(this), amount);
    balances[vaultId] = balances[vaultId].add(amount);
    emit TreasuryIncrease(vaultId, amount);
  }

  /**
   * @notice Removes Aurei from the treasury.
	 * @dev Only callable by Probity
	 */
  function decrease(uint256 amount, uint vaultId) external override onlyOwner {
    aurei.burn(address(this), amount);
    balances[vaultId] = balances[vaultId].sub(amount);
    emit TreasuryDecrease(vaultId, amount);
  }

}
