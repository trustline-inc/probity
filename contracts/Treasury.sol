// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/ProbityBase.sol";
import "./Dependencies/SafeMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IProbity.sol";
import "./Interfaces/ITreasury.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Treasury is ITreasury, Ownable {
  using SafeMath for uint256;

  // --- Data ---

  mapping (uint => uint) public balances;

  IAurei public aurei;
  IProbity public probity;

  enum Contract { Aurei, Probity }
  mapping (Contract => address) private contracts;

  // --- Constructor ---

  constructor() Ownable(msg.sender) {

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
  function increase(uint256 amount, uint vaultId) external override onlyProbity {
    aurei.mint(address(this), amount);
    balances[vaultId] = balances[vaultId].add(amount);
    emit TreasuryIncrease(vaultId, amount);
  }

  /**
   * @notice Removes Aurei from the treasury.
	 * @dev Only callable by Probity
	 */
  function decrease(uint256 amount, uint vaultId) external override onlyProbity {
    aurei.burn(address(this), amount);
    balances[vaultId] = balances[vaultId].sub(amount);
    emit TreasuryDecrease(vaultId, amount);
  }

  // --- Helpers ---

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function setAddress(Contract name, address addr) public onlyOwner {
    if (name == Contract.Aurei) aurei = IAurei(addr);
    if (name == Contract.Probity) probity = IProbity(addr);
    contracts[name] = addr;
  }

  // --- Modifiers ---

  /**
	 * @dev Ensure that msg.sender === Probity contract address.
	 */
	modifier onlyProbity {
		require(msg.sender == contracts[Contract.Probity]);
		_;
	}

}
