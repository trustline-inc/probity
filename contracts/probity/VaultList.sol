// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract VaultList {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    address[] public vaultList;
    uint256 public numberOfVaults;
    mapping(address => bool) public vaultExists;

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////
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
