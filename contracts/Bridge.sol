// SPDX-License-Identifier: MIT

/**
 * @dev Flare network <> XRPL, Aurei bridge contract
 * The purpose for this smart contract is to be able to issue the stablecoin AUR(Aurei) on XRP ledger in a
 * trustless manner backed by 1:1 with AUR on the flare network. This contract will lock up the AUR amount that is
 * to be issued in XRPL and users looking to hold AUR on XRPL should check this smart contract to verify that
 * the issuer has followed the procedure laid out below. If the issuer doesn't follow the procedure precisely,
 * they will be penalized by losing the AUR they deposited,  * and a portion of it rewarded
 * to the person that proved the misuse
 *
 *
 * The process to Issue AUR on XRPL:
 * - On XRPL, User need 2 XRPL accounts, 'issuer account' and 'receiver account'
 * - On Flare, User needs give Bridge contract (this contract) AUR allowance by amount they wish to issue on XRPL
 * - On Flare, lock up Aurei in this smart contract by calling 'newIssuer' with the XRPL issuer account address and amount
 * - On XRPL, create a trustline from 'receiver account' to 'issuer account' with 'amount' locked in bridgeContract
 * - On XRPL, set issuer account setting 'defaultRippling" to true and 'disableAuth' to false
 * - On XRPL, add regular key ACCOUNT_ONE to issuer account settings
 * - On XRPL, issue exactly the 'amount' from issuer account to receiver account
 * - On XRPL, set the issuer account setting 'disableMasterKey' to true
 * - On FLare, call stateConnector contract and prove the payment by calling 'provePaymentFinality' and provide the txHash on XRPL
 * - On Flare, call stateConnector contract and prove that the issuer account can no longer issue
 *        by calling 'TBD' (This feature has not been implemented)
 * - On Flare, call 'completeIssuance' on this contract which will complete the Issuer's issuance
 * - On Flare, call 'verifyIssuer' on this contract to verify that issuer can no longer issue
 *      anymore AUR (This can only be done after stateConnector has implemented the feature)
 *
 * The process to Redeem AUR on XRPL:
 * - On Flare, call redepmtionAttempt to pre-register an redemption attempt
 * - On XRPL, send the AUR back to the issuer by the amount you wish you redeem
 * - On Flare, call stateConnector contract and prove the payment has completed
 * - On Flare, call bridge contract's `redeemAUR` function to unlock the AUR
 *
 *
 * Shine Lee @shine2lay - shine@trustline.co
 **/

pragma solidity ^0.7.4;

import "./Interfaces/IAurei.sol";
import "./Interfaces/IStateConnector.sol";

// new version
contract Bridge {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////
  event RedemptionCompleted(bytes32 indexed txHashOnXRP, uint256 amount);

  event IssuanceCompleted(string issuer, uint256 amount);
  /////////////////////////////////////////
  // Modifiers
  /////////////////////////////////////////
  modifier issuerExists(string calldata issuer) {
    require(
      issuers[issuer].sender != address(0),
      "This issuer does not exists"
    );
    _;
  }

  modifier issuerMustBeInProgress(string calldata issuer) {
    require(
      issuers[issuer].status == IssuerStatus.IN_PROGRESS,
      "issuer status is not longer IN_PROGRESS"
    );
    _;
  }

  modifier issuerDoesNotExists(string calldata issuer) {
    require(
      issuers[issuer].sender == address(0),
      "This issuer already exists "
    );
    _;
  }

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  /**
   *        0 = DOES_NOT_EXIST (default value, issuer doesn't exits)
   *        0 = IN_PROGRESS (AUR is locked but user have not issued on XRPL yet)
   *        1 = CANCELLED (AUR is no longer held and user have cancel the issuer)
   *        2 = COMPLETE (Issuance is complete but have not proven that they can no longer issue more AUR,
   *               meaning the client side should validate more before accepting) **
   *        3 = VERIFIED (no need for more validation)
   *        4 = REDEEMED (all the AUR issued has already been REDEEMED, so this issuer is no longer valid)
   *        5 = FRAUD (The issuer address have been verified to have more than 1 issuance thus no longer valid)
   **/
  enum IssuerStatus {
    DOES_NOT_EXIST,
    IN_PROGRESS,
    CANCELED,
    COMPLETE,
    VERIFIED,
    REDEEMED,
    FRAUD
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
    bytes32 txHashOnXRP;
    IssuerStatus status;
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
   * @dev Check the Issuer's status
   *
   * Users should call this function to check whether they should accept AUR from this issuer 
   *
   * @param issuer the XRPL address of the issuer
   * @return status
   *        0 = IN_PROGRESS (AUR is locked but user have not issued on XRPL yet)
   *        1 = CANCELLED (AUR is no longer held and user have cancel the issuer) 
   *        2 = COMPLETE (issuer is complete but have not proven that they can no longer issue more AUR, 
                  meaning the client side should validate more before accepting) **
   *        3 = VERIFIED (no need for more validation)
   *        4 = REDEEMED (all the AUR issued has already been REDEEMED, so this issuer is no longer valid)
   *  **this is a stop gap before the verification is implemented in stateConnector contract
  **/
  function checkIssuerStatus(string calldata issuer)
    external
    view
    returns (IssuerStatus status)
  {
    return issuers[issuer].status;
  }

  /**
   * @dev Lock up AUR for new issuer
   *
   * This function locks up and AUR and allow user to issue AUR of the same amount on XRPL
   * from the provided xrpAddress
   *
   * @param issuer the XRPL address of the issuer
   * @param amount the amount of AUR to lock up and also issue on the XRPL
   **/
  function newIssuer(string calldata issuer, uint256 amount)
    external
    issuerDoesNotExists(issuer)
  {
    require(amount != 0, "amount must be a non zero amount");
    aurei.transferFrom(msg.sender, address(this), amount);
    issuers[issuer].amount = amount;
    issuers[issuer].sender = msg.sender;
    issuers[issuer].status = IssuerStatus.IN_PROGRESS;
  }

  /**
   * @dev Cancel an issuer and release the AUR locked up associated with the issuer
   * The user canceling the issuer must be the same user that initiated the createissuer
   *
   * @param issuer issuerAddress on XRP
   **/
  function cancelIssuer(string calldata issuer)
    external
    issuerExists(issuer)
    issuerMustBeInProgress(issuer)
  {
    require(
      issuers[issuer].sender == msg.sender,
      "Only the original sender of the is issuer can cancel it"
    );

    // refund AUR to the msg.sender
    aurei.transfer(msg.sender, issuers[issuer].amount);

    issuers[issuer].status = IssuerStatus.CANCELED;
  }

  /**
   * @dev Prove that the AUR issuer on XRPL has completed so that the issuer address can be marked as valid issuer
   *      by marking the issuer Address as COMPLETE
   *
   * @param txHash the payment tx ID from XRPL
   * @param source address of the tx
   * @param issuer address of the tx
   * @param destinationTag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function completeIssuance(
    bytes32 txHash,
    string calldata source,
    string calldata issuer,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) external issuerMustBeInProgress(issuer) {
    verifyPaymentFinality(
      txHash,
      source,
      issuer,
      destinationTag,
      amount,
      currencyHash
    );

    issuers[issuer].txHashOnXRP = txHash;
    issuers[issuer].status = IssuerStatus.COMPLETE;
    emit IssuanceCompleted(issuer, amount);
  }

  /**
   * @dev every issuer address is only allowed to do One issuer, by proving the 2nd issuer from the account,
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
      issuers[issuer].txHashOnXRP != txHash,
      "The provided txHash has already proven"
    );
    verifyPaymentFinality(
      txHash,
      source,
      issuer,
      destinationTag,
      amount,
      currencyHash
    );

    issuers[issuer].status = IssuerStatus.FRAUD;
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
    bytes32 redemptionHash =
      createRedemptionAttemptHash(source, issuer, destinationTag);

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
    bytes32 redemptionHash =
      createRedemptionAttemptHash(source, issuer, destinationTag);
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
      issuers[issuer].status = IssuerStatus.REDEEMED;
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
   * @param source address of the tx
   * @param issuer address of the tx
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
    (, , bool isFinal) =
      stateConnector.getPaymentFinality(
        uint32(0),
        txHash,
        keccak256(abi.encodePacked(source)),
        keccak256(abi.encodePacked(issuer)),
        destinationTag,
        amount,
        currencyHash
      );
    require(
      isFinal,
      "This Transaction has not been proven in stateConnector contract"
    );
  }
}
