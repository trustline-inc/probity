// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Manages minting and burning of Aurei.
 */
interface ITreasury {

  // --- Events ---

  function mint(uint256 _amount) external;

  function burn(uint256 _amount) external;
}
