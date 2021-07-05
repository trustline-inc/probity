pragma solidity ^0.8.0;

import "../Interfaces/IStateConnector.sol";

contract StateConnector is IStateConnector {
  bool finalityToReturn;

  function setFinality(bool newFinality) public {
    finalityToReturn = newFinality;
  }

  function getPaymentFinality(
    uint32 chainId,
    bytes32 txId,
    bytes32 sourceHash,
    bytes32 destinationHash,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  )
    external
    override
    returns (
      uint64 ledger,
      uint64 indexSearchRegion,
      bool finality
    )
  {
    return (uint64(0), uint64(0), finalityToReturn);
  }

  function provePaymentFinality(
    uint32 chainId,
    bytes32 paymentHash,
    uint64 ledger,
    string memory txId
  )
    external
    override
    returns (
      uint32 _chainId,
      uint64 _ledger,
      uint64 finalisedLedgerIndex,
      bytes32 _paymentHash,
      string memory _txId
    )
  {
    return (_chainId, _ledger, finalisedLedgerIndex, _paymentHash, _txId);
  }
}
