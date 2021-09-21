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
   * 0 = PENDING    - Tokens are locked but are not issued on the XRPL)
   * 1 = CANCELLED  - Tokens are returned the issuer is cancelled)
   * 2 = COMPLETE   - Tokens are issued but unverified for spending
   * 3 = VERIFIED   - Tokens are verified for spending
   * 4 = REDEEMED   - Tokens are fully redeemed and the issuer is no longer valid
   * 5 = FRAUDULENT - Tokens are issued but the issuer is invalid
   **/
  enum Status {
    PENDING,
    CANCELED,
    COMPLETED,
    VERIFIED,
    REDEEMED,
    FRAUDULENT
  }

  struct PreRedemption {
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
  mapping(bytes32 => PreRedemption) public preRedemptions;
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
   * @dev Every issuer address is only allowed to do One issuer, by proving the 2nd issuer from the account,
   *      you can prove that the issuer account is no longer legit and can be consider fraudulent
   *      the one who submit the proof will be given a reward from some of the AUR that has been locked in by the
   *      issuer address
   *
   * @param txHash the payment tx ID from XRPL
   * @param source address of the tx
   * @param issuer the issuer address of the tx
   * @param destinationTag the issuer Tag of tx
   * @param amount sent in tx
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
      "The provided tx hash has already proven."
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
    // send all of the AUR to the sender of this call as reward
    aurei.transfer(msg.sender, amountToSend);
  }

  /**
   * @dev Pre-register a redemption attempt, this will allow the msg.sender to be the only that can prove tx to redeem
   *      and specify the issuer to where the AUR will be released
   *
   * @param source the source address in the tx
   * @param issuer the issuer address of the tx
   * @param destinationTag the issuer Tag of tx
   **/
  function redemptionAttempt(
    string calldata source,
    string calldata issuer,
    uint64 destinationTag
  ) external {
    bytes32 redemptionHash = createRedemptionAttemptHash(
      source,
      issuer,
      destinationTag
    );

    // each preRedemptions entry last for 2 hours, within 2 hours, the redeemer don't need to redeem again
    require(
      block.timestamp >= preRedemptions[redemptionHash].createdAt + 7200,
      "The previous redemption attempt for this parameter was submitted less than 2 hours ago"
    );

    preRedemptions[redemptionHash].redeemer = msg.sender;
    preRedemptions[redemptionHash].createdAt = block.timestamp;
  }

  function createRedemptionAttemptHash(
    string calldata source,
    string calldata issuer,
    uint64 destinationTag
  ) public pure returns (bytes32 redepmtionHash) {
    return keccak256(abi.encode(source, issuer, destinationTag));
  }

  /**
   * @dev Prove that the AUR has been sent back to issuer on XRPL and the contract will release the AUR in the same
   *      amount sent.
   *
   * @param txHash the payment tx ID from XRPL
   * @param source the source address in the tx
   * @param issuer the issuer address of the tx
   * @param destinationTag the issuer Tag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function completeRedemption(
    bytes32 txHash,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash,
    address destAddress
  ) external {
    require(
      destAddress != address(0),
      "Destination address can not be zero Address"
    );
    require(
      redemptions[txHash].AURreleaseAddress == address(0),
      "This txHash has already been redeemed"
    );
    bytes32 redemptionHash = createRedemptionAttemptHash(
      source,
      issuer,
      destinationTag
    );
    require(
      preRedemptions[redemptionHash].redeemer == msg.sender,
      "Only the user that submitted the redemption attempt can submit redemption tx"
    );

    verifyPaymentFinality(
      txHash,
      source,
      issuer,
      destinationTag,
      amount,
      currencyHash
    );
    issuers[issuer].amount = issuers[issuer].amount - amount;
    aurei.transfer(destAddress, amount);
    redemptions[txHash] = Redemption(
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

    emit RedemptionCompleted(txHash, amount);
  }

  /**
   * @dev The final step in issuer is to prove that Issuer can no longer issue anymore AUR, making it verified that
   *      this particular issuer can no longer issue any more AUR thus can no longer gain the system.
   *  NOTE: THIS FUNCTION CAN ONLY BE IMPLEMENTED AFTER FLARE TEAM IMPLEMENT THE FUNCTION THAT WILL HELP VERIFY
   *        THAT AN ISSUER CAN NO LONGER ISSUE ANYMORE AUR
   **/
  //  function proveIssuerRequiredSettings(
  //  ) external {
  //
  //  }

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  /**
   * @dev Prove that the AUR issuer on XRPL has completed so that the issuer address can be marked as valid issuer
   *
   * @param txHash the payment tx ID from XRPL
   * @param source address of the tx - @shine2lay to clarify
   * @param issuer address of the issuer
   * @param destinationTag the issuer Tag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function verifyPaymentFinality(
    bytes32 txHash,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) internal {
    (, , bool isFinal) = stateConnector.getPaymentFinality(
      uint32(0),
      txHash,
      keccak256(abi.encodePacked(issuer)),
      amount,
      currencyHash
    );
    require(
      isFinal,
      "This Transaction has not been proven in stateConnector contract"
    );
  }
}
