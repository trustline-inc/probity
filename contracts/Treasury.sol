// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ITreasury.sol";
import "./Interfaces/IAurei.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Treasury is ITreasury, Ownable {

  IAurei public aurei;
  
  constructor(address _aurei) Ownable(msg.sender) {
    aurei = IAurei(_aurei);
  }
  /**
	 * @dev We need to ensure that this is only callable by the Probity contract.
	 * We can use a onlyOwner modifier to ensure this.
	 */
  function mint(uint256 _amount) external override onlyOwner {
    aurei.mint(_amount);
  }

  function burn(uint256 _amount) external override onlyOwner {
    aurei.burn(_amount);
  }

}
