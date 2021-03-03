// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/ITeller.sol";
import "./Dependencies/Ownable.sol";

/**
 * @notice Manages debts for all vaults.
 */
contract Teller is ITeller, Ownable {
  
  enum State { Waiting, Ready, Active }
  State public state = State.Waiting;

  function isActive() view public returns(bool) {
    return state == State.Active;
  }

  function changeState(State _newState) public {
    state = _newState;
  }

  function getState() view public returns(State) {
    return state;
  }
}
