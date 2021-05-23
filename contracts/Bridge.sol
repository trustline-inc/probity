// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Interfaces/IStateConnector.sol";

contract Bridge {
  IAurei aurei;
  IStateConnector stateConnector;

  event AureiTransferToFlareCompleted(
    bytes32 indexed txHashOnXRP,
    uint256 amount
  );
  event AureiTransferToXRPCompleted(
    bytes32 indexed txHashOnXRP,
    uint256 amount
  );
  event NewPendingTransferToXRP(bytes32 indexed txHash, uint256 amount);

  enum TransferStatus {PENDING, IN_PROGRESS, COMPLETE}

  struct toFlareEntry {
    bool exists;
    uint64 ledger;
    bytes32 sourceHash;
    bytes32 destinationHash;
    uint64 destinationTag;
    uint64 amount;
    address destinationAddress;
  }

  struct toXRPEntry {
    bool exists;
    string destination;
    uint256 amount;
    uint256 nonce;
    string txIdOnXRP;
    TransferStatus status;
  }

  mapping(bytes32 => toFlareEntry) public toFlareTransfers;
  mapping(bytes32 => toXRPEntry) public toXRPTransfers;
  bytes32[] toXRPTransferHashes;

  constructor(address aureiAddress, address stateConnectorAddress) {
    aurei = IAurei(aureiAddress);
    stateConnector = IStateConnector(stateConnectorAddress);
  }

  function getToXRPTransferHashes()
    external
    view
    returns (bytes32[] memory transfers)
  {
    return toXRPTransferHashes;
  }

  function transferAureiToXRP(
    string calldata xrpAddress,
    uint256 amount,
    uint256 nonce
  ) external {
    bytes32 txHash = calculateTxHash(xrpAddress, amount, nonce);
    require(
      toXRPTransfers[txHash].exists == false,
      "This transaction hash already exists, please try using a different nonce"
    );

    aurei.transferFrom(msg.sender, address(this), amount);
    toXRPTransfers[txHash] = toXRPEntry(
      true,
      xrpAddress,
      amount,
      nonce,
      "0",
      TransferStatus.PENDING
    );

    toXRPTransferHashes.push(txHash);
    emit NewPendingTransferToXRP(txHash, amount);
  }

  /**
   * @param nonce could be any integer, to avoid collision, use timestamp
   */
  function calculateTxHash(
    string calldata xrpAddress,
    uint256 amount,
    uint256 nonce
  ) public view returns (bytes32 hash) {
    return keccak256(abi.encodePacked(msg.sender, xrpAddress, amount, nonce));
  }

  function updateTransferStatus(
    bytes32 txHash,
    string calldata txIdOnXRP,
    TransferStatus status
  ) external {
    toXRPTransfers[txHash].status = status;
    toXRPTransfers[txHash].txIdOnXRP = txIdOnXRP;
  }

  function completeToXRPTransfer(
    bytes32 txHash,
    bytes32 txHashOnXRP,
    uint64 ledger,
    bytes32 sourceHash,
    bytes32 destinationHash,
    uint64 destinationTag,
    uint64 amount
  ) external {
    (bool verified, uint256 timestamp) =
      stateConnector.getPaymentFinality(
        uint32(0),
        txHashOnXRP,
        ledger,
        sourceHash,
        destinationHash,
        destinationTag,
        amount
      );
    require(
      verified && timestamp < block.timestamp,
      "This Transaction has not been proven in stateConnector contract"
    );

    toXRPTransfers[txHash].status = TransferStatus.COMPLETE;
    emit AureiTransferToXRPCompleted(txHash, amount);
  }

  function transferAureiToFlare(
    bytes32 txHash,
    uint64 ledger,
    bytes32 sourceHash,
    bytes32 destinationHash,
    uint64 destinationTag,
    uint64 amount,
    address destAddress
  ) external {
    require(!toFlareTransfers[txHash].exists, "Tx hash already exists");
    require(
      aurei.balanceOf(address(this)) > amount,
      "Requested Aurei balance is higher than what the contract currently holds"
    );
    // commented out to make this contract work with flare's coston testnet which is pointed at the XRPL mainnet
    //    (bool verified, uint256 timestamp) =
    //      stateConnector.getPaymentFinality(
    //        uint32(0),
    //        txHash,
    //        ledger,
    //        sourceHash,
    //        destinationHash,
    //        destinationTag,
    //        amount
    //      );
    //    require(
    //      verified && timestamp < block.timestamp,
    //      "This Transaction has not been proven in stateConnector contract"
    //    );

    aurei.transfer(destAddress, amount);

    toFlareTransfers[txHash] = toFlareEntry(
      true,
      ledger,
      sourceHash,
      destinationHash,
      destinationTag,
      amount,
      destAddress
    );
    emit AureiTransferToFlareCompleted(txHash, amount);
  }
}
