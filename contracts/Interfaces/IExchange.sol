// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchange {
  
  // --- Events ---

  function executeOrder(address lender, address borrower, uint amount, uint rate) external;
}
