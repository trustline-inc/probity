// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IStateConnector {
  // --- Events ---

  event AureiBalanceUpdated(address _user, uint256 _amount);

  // --- Functions ---

  function getPaymentFinality(
    uint32 chainId,
    bytes32 txId,
    uint64 ledger,
    bytes32 sourceHash,
    bytes32 destinationHash,
    uint64 destinationTag,
    uint64 amount
  ) external returns (bool finality, uint256 timestamp);

  function provePaymentFinality(
    uint32 chainId,
    uint64 claimPeriodIndex,
    bytes32 claimPeriodHash,
    bytes32 paymentHash,
    string memory txId
  ) external;
}
