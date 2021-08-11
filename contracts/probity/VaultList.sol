// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract VaultList {
  mapping(address => bool) public vaultExists;
  address[] public vaultList;
  uint256 public numberOfVaults;

  // @todo figure out who will call this function , externally? or from collateral?
  function addVaultToList(address owner) external {
    if (!vaultExists[owner]) {
      vaultExists[owner] = true;
      vaultList[numberOfVaults++] = owner;
    }
  }

  function getVaultList() external view returns (address[] memory) {
    return vaultList;
  }
}
