// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages contracts registry
 */
interface IRegistry {
  // --- Functions --
  enum Contract {
    Aurei,
    Bridge,
    Ftso,
    TcnToken,
    Teller,
    Treasury,
    Vault,
    Governance
  }

  function setupContractAddress(Contract name, address _addr) external;

  function getContractAddress(Contract name) external view returns (address);
}
