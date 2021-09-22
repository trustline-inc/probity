// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IAurei.sol";
import "./interfaces/IStateConnector.sol";

contract Bridge {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////

  event RedemptionCompleted(bytes32 indexed XrplTxId, uint256 amount);
  event IssuanceCompleted(string issuer, uint256 amount);

  /////////////////////////////////////////
  // Modifiers
  /////////////////////////////////////////

  modifier issuerExists(string calldata issuer) {
    require(issuers[issuer].sender != address(0), "The issuer does not exist.");
    _;
  }

  modifier issuerMustBePending(string calldata issuer) {
    require(
      issuers[issuer].status == Status.PENDING,
      "The issuer is not in the PENDING state."
    );
    _;
  }

  modifier issuerDoesNotExist(string calldata issuer) {
    require(
      issuers[issuer].sender == address(0),
      "An issuer already exists with this address."
    );
    _;
  }

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////

  /**
   * 0 = NON_EXISTENT - There are no tokens locked for the issuer
   * 1 = PENDING      - Tokens are locked but are not issued on the XRPL)
   * 2 = CANCELLED    - Tokens are returned the issuer is cancelled)
   * 3 = COMPLETE     - Tokens are issued but unverified for spending
   * 4 = VERIFIED     - Tokens are verified for spending
   * 5 = REDEEMED     - Tokens are fully redeemed and the issuer is no longer valid
   * 6 = FRAUDULENT   - Tokens are issued but the issuer is invalid
   **/
  enum Status {
    NON_EXISTENT,
    PENDING,
    CANCELED,
    COMPLETED,
    VERIFIED,
    REDEEMED,
    FRAUDULENT
  }

  struct Reservation {
    address redeemer;
    uint256 createdAt;
  }

  struct Redemption {
    string source;
    string issuer;
    uint64 destinationTag;
    uint64 amount;
    address AURreleaseAddress;
    address redeemer;
  }

  struct Issuer {
    uint256 amount;
    address sender;
    bytes32 XrplTxId;
    Status status;
  }

  IAurei aurei;
  IStateConnector stateConnector;

  // redemption hash keccak256(source, issuer, destinationTag)
  mapping(bytes32 => Reservation) public reservations;
  // redemption hash (source, issuer, destinationTag)
  mapping(bytes32 => Redemption) public redemptions;
  // issuer address to the amount Issuer struct
  mapping(string => Issuer) public issuers;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////

  constructor(address aureiAddress, address stateConnectorAddress) {
    aurei = IAurei(aureiAddress);
    stateConnector = IStateConnector(stateConnectorAddress);
  }

  /////////////////////////////////////////
  // Public functions
  /////////////////////////////////////////

  /**
   * @notice Call this function to check whether to accept tokens from this issuer
   * @dev This is a stopgap before the verification is implemented in state connector contract
   * @param issuer the XRPL address of the issuer
   * @return status
   */
  function getIssuerStatus(string calldata issuer)
    external
    view
    returns (Status status)
  {
    return issuers[issuer].status;
  }

  /**
   * @notice Locks up tokens for XRPL issuance
   * @param issuer the XRPL address of the issuer
   * @param amount the amount of tokens to be issued on the XRPL
   **/
  function createIssuer(string calldata issuer, uint256 amount)
    external
    issuerDoesNotExist(issuer)
  {
    require(amount > 0, "Amount must be greater than zero.");
    aurei.transferFrom(msg.sender, address(this), amount);
    issuers[issuer].amount = amount;
    issuers[issuer].sender = msg.sender;
    issuers[issuer].status = Status.PENDING;
  }

  /**
   * @notice Cancels a pending issuer and returns the locked tokens to the originator.
   * @dev The caller must be originating account of the issuing address.
   * @param issuer issuing address on the XRPL.
   **/
  function cancelIssuer(string calldata issuer)
    external
    issuerExists(issuer)
    issuerMustBePending(issuer)
  {
    require(
      issuers[issuer].sender == msg.sender,
      "Only the originating account can cancel this issuer."
    );
    aurei.transfer(msg.sender, issuers[issuer].amount);
    issuers[issuer].status = Status.CANCELED;
  }

  /**
   * @notice Prove that the XRPL issuance completed so that the issuer can be validated.
   * @dev Marks the status of the issuer as COMPLETED
   * @param txHash the XRPL payment tx ID
   * @param source the address of the source - @shine2lay to clarify
   * @param issuer the address of the issuer
   * @param destinationTag the destination tag
   * @param amount the amount issued
   * @param currencyHash hash of the currency code
   **/
  function completeIssuance(
    bytes32 txHash,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) external issuerMustBePending(issuer) {
    verifyPaymentFinality(
      txHash,
      source,
      issuer,
      destinationTag,
      amount,
      currencyHash
    );

    issuers[issuer].XrplTxId = txHash;
    issuers[issuer].status = Status.COMPLETED;
    emit IssuanceCompleted(issuer, amount);
  }

  /**
   * @notice Every issuer is only allowed one issuance. By proving a second issuance,
   * you can prove that the issuer account is invalid. The fraudulent issuer is penalized
   * and the prover earns the penalty as a reward.
   * @dev Currently sends all of the tokens as reward
   * @param txHash the issuance tx ID from the XRPL
   * @param source the source address of the tx
   * @param issuer the issuer address of the tx
   * @param destinationTag the destination tag of the tx
   * @param amount the amount sent in the tx
   * @param currencyHash hash of the currency code
   **/
  function proveFraud(
    bytes32 txHash,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) external {
    require(
      issuers[issuer].XrplTxId != txHash,
      "The provided transaction has already been proved."
    );
    verifyPaymentFinality(
      txHash,
      source,
      issuer,
      destinationTag,
      amount,
      currencyHash
    );

    issuers[issuer].status = Status.FRAUDULENT;
    uint256 amountToSend = issuers[issuer].amount;
    issuers[issuer].amount = 0;
    aurei.transfer(msg.sender, amountToSend);
  }

  /**
   * @notice Creates a reservation for msg.sender to prove the XRPL redemption transaction.
   * @dev The redemption reservation window is 2 hours long
   * @param source the source address in the tx
   * @param issuer the issuer address of the tx
   * @param destinationTag the destination tag of the tx
   **/
  function createRedemptionReservation(
    string calldata source,
    string calldata issuer,
    uint64 destinationTag
  ) external {
    bytes32 redemptionHash = createRedemptionReservationHash(
      source,
      issuer,
      destinationTag
    );

    // Can't make another reservation while the reservation is already activated.
    require(
      block.timestamp >= reservations[redemptionHash].createdAt + 7200,
      "The previous redemption reservation for these parameters was submitted less than 2 hours ago."
    );

    reservations[redemptionHash].redeemer = msg.sender;
    reservations[redemptionHash].createdAt = block.timestamp;
  }

  function createRedemptionReservationHash(
    string calldata source,
    string calldata issuer,
    uint64 destinationTag
  ) public pure returns (bytes32 redepmtionHash) {
    return keccak256(abi.encode(source, issuer, destinationTag));
  }

  /**
   * @notice Proves that trustless issued currency was redeemed on the XRPL and sends an equivalent amount to msg.sender.
   * @param txID the payment tx ID from the XRPL
   * @param source the source address in the tx
   * @param issuer the issuer address of the tx
   * @param destinationTag the issuer Tag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function completeRedemption(
    bytes32 txID,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash,
    address destAddress
  ) external {
    require(
      destAddress != address(0),
      "Destination address cannot be the zero address."
    );
    require(
      redemptions[txID].AURreleaseAddress == address(0),
      "This transaction ID has already been used to redeem tokens."
    );
    bytes32 redemptionHash = createRedemptionReservationHash(
      source,
      issuer,
      destinationTag
    );
    require(
      reservations[redemptionHash].redeemer == msg.sender,
      "Only the reservation holder can submit a redemption transaction."
    );

    verifyPaymentFinality(
      txID,
      source,
      issuer,
      destinationTag,
      amount,
      currencyHash
    );
    issuers[issuer].amount = issuers[issuer].amount - amount;
    aurei.transfer(destAddress, amount);
    redemptions[txID] = Redemption(
      source,
      issuer,
      destinationTag,
      amount,
      destAddress,
      msg.sender
    );

    if (issuers[issuer].amount == 0) {
      issuers[issuer].status = Status.REDEEMED;
    }

    emit RedemptionCompleted(txID, amount);
  }

  /**
   * TODO: The final step for trustless issued currency is proving that the issuing account is blackholed.
   * Once this is proven, the issuing address can be verified.
   *
   * FLARE TEAM MUST IMPLEMENT STATE CONNECTOR FUNCTION TO VERIFY BLACKHOLED ISSUERS.
   **/
  function proveIssuingAccountSettingsCompliance() external {}

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  /**
   * @dev Proves that the XRPL issuance is completed.
   * @param txID the issuance transaction ID from the XRPL
   * @param issuer the address of the issuing account
   * @param amount the issuance amount
   * @param currencyHash hash of the currency code
   **/
  function verifyPaymentFinality(
    bytes32 txID,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) internal {
    (, , bool isFinal) = stateConnector.getPaymentFinality(
      uint32(0),
      txID,
      keccak256(abi.encodePacked(issuer)),
      amount,
      currencyHash
    );
    require(isFinal, "The state connector did not prove this transaction.");
  }
}
