pragma solidity ^0.8.0;

import "../Dependencies/Pausable.sol";
import "../Interfaces/IVault.sol";

contract FLRCollateral is Pausable {
  bytes32 collateralId;
  IVault vault;

  constructor(address registryAddress, bytes32 collateralHash)
    Pausable(registryAddress)
  {
    collateralId = collateralHash;
    vault = IVault(registry.getContractAddress(IRegistry.Contract.Vault));
  }

  function deposit() external payable onlyWhenUnPaused {
    vault.depositCollateral(collateralId, msg.sender, msg.value);
  }

  function withdraw(uint256 amount) external onlyWhenUnPaused {
    require(payable(msg.sender).send(amount), "FLR_COLL: fail to send FLR");
    vault.withdrawCollateral(collateralId, msg.sender, amount);
  }
}
