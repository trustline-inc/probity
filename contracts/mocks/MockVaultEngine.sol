pragma solidity ^0.8.0;

contract MockVaultEngine {
  mapping(address => uint256) public AUR;
  mapping(address => uint256) public TCN;

  function addAurei(address user, uint256 amount) external {
    AUR[user] += amount;
  }

  function removeAurei(address user, uint256 amount) external {
    AUR[user] -= amount;
  }

  function reduceYield(address user, uint256 amount) external {
    TCN[user] -= amount;
  }

  // added for testing purposes
  function addTcn(address user, uint256 amount) external {
    TCN[user] += amount;
  }
}
