// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../Dependencies/ProbityBase.sol";

/**
 * @notice Manages contracts registry
 */
interface IRegistry {
  // --- Functions --

  function setupContractAddress(ProbityBase.Contract name, address _addr)
    external;

  function getContractAddress(ProbityBase.Contract name)
    external
    view
    returns (address);
}
