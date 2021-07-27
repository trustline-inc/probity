// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "../Dependencies/Base.sol";

/**
 * @notice Manages contracts registry
 */
interface IRegistry {
  // --- Functions --

  function setupContractAddress(Base.Contract name, address _addr) external;

  function getContractAddress(Base.Contract name)
    external
    view
    returns (address);
}
