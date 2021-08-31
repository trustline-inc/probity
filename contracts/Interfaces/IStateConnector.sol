// SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IStateConnector {
  // --- Functions ---

  function getPaymentFinality(
    uint32 chainId,
    bytes32 txId,
    bytes32 destinationHash,
    uint64 amount,
    bytes32 currencyHash
  )
    external
    returns (
      uint64 ledger,
      uint64 indexSearchRegion,
      bool finality
    );

  function provePaymentFinality(
    uint32 chainId,
    bytes32 paymentHash,
    uint64 ledger,
    string memory txId
  )
    external
    returns (
      uint32 _chainId,
      uint64 _ledger,
      uint64 finalisedLedgerIndex,
      bytes32 _paymentHash,
      string memory _txId
    );
}
