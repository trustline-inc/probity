// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Dependencies/Ownable.sol";
import "./Dependencies/DSMath.sol";
import "./Interfaces/IAurei.sol";
import "./Interfaces/IExchange.sol";
import "./Interfaces/IRegistry.sol";
import "./Interfaces/ITeller.sol";
import "./Interfaces/ITreasury.sol";
import "./Interfaces/IVault.sol";
import "hardhat/console.sol";

/**
 * @notice Executes signed loan orders.
 */
contract Exchange is IExchange, Ownable, ProbityBase, DSMath {
  // --- Data ---

  IAurei public aurei;
  ITeller public teller;
  ITreasury public treasury;
  IRegistry public registry;
  IVault public vault;

  // --- Constructor ---

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  /**
   * @notice Set the address of a dependent contract.
   * @dev Should probably make this inheritable.
   */
  function initializeContract() external onlyOwner {
    aurei = IAurei(registry.getContractAddress(Contract.Aurei));
    teller = ITeller(registry.getContractAddress(Contract.Teller));
    treasury = ITreasury(registry.getContractAddress(Contract.Treasury));
    vault = IVault(registry.getContractAddress(Contract.Vault));
  }

  // --- External Functions ---

  /**
   * @notice Executes a loan order.
   * @param collateral - The amount of collateral securing the loan.
   * @param principal - The amount of Aurei to borrow.
   */
  function executeOrder(uint256 collateral, uint256 principal)
    external
    override
  {}
}
