pragma solidity ^0.8.0;

import "../Dependencies/Pausable.sol";
import "../Interfaces/IVault.sol";
import "../Dependencies/IERC20.sol";

contract ERC20Collateral is Pausable {
  bytes32 collateralId;
  IVault vault;
  IERC20 collateralToken;

  constructor(
    address registryAddress,
    bytes32 collateralHash,
    IERC20 collateral
  ) Pausable(registryAddress) {
    collateralId = collateralHash;
    vault = IVault(registry.getContractAddress(IRegistry.Contract.Vault));
    collateralToken = collateral;
  }

  function deposit(uint256 amount) external onlyWhenUnPaused {
    require(
      collateralToken.transferFrom(msg.sender, address(this), amount),
      "ERC20_COLL: transfer failed"
    );
    vault.depositCollateral(collateralId, msg.sender, amount);
  }

  function withdraw(uint256 amount) external onlyWhenUnPaused {
    require(
      collateralToken.transfer(msg.sender, amount),
      "ERC20_COLL: transfer failed"
    );
    vault.withdrawCollateral(collateralId, msg.sender, amount);
  }
}
