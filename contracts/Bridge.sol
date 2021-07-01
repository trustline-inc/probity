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
 * - On Flare, lock up Aurei in this smart contract by calling 'createIssuance' with the XRPL issuer account address and amount
 * - On XRPL, create a trustline from 'receiver account' to 'issuer account' with 'amount' locked in bridgeContract
 * - On XRPL, set issuer account setting 'defaultRippling" to true and 'disableAuth' to false
 * - On XRPL, add regular key ACCOUNT_ONE to issuer account settings
 * - On XRPL, issue exactly the 'amount' from issuer account to receiver account
 * - On XRPL, set the issuer account setting 'disableMasterKey' to true
 * - On FLare, call stateConnector contract and prove the payment by calling 'provePaymentFinality' and provide the txID on XRPL
 * - On Flare, call stateConnector contract and prove that the issuer account can no longer issue
 *        by calling 'TBD' (This feature has not been implemented)
 * - On Flare, call 'completeIssuance' on this contract which will complete the Issuance
 * - On Flare, call 'verifyIssuer' on this contract to verify that issuer can no longer issue
 *      anymore AUR (This can only be done after stateConnector has implemented the feature)
 *
 * The process to Redeem AUR on XRPL:
 * - On XRPL, send the AUR back to the issuer by the amount you wish you redeem
 * - On Flare, call stateConnector contract and prove the payment has completed
 * - On Flare, call bridge contract's `redeemAUR` function to unlock the AUR
 *
 *
 * Shine Lee @shine2lay - shine@trustline.co
 **/
pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";
import "./Interfaces/IStateConnector.sol";

// new version
contract Bridge {
  /////////////////////////////////////////
  // Events
  /////////////////////////////////////////
  event RedemptionCompleted(bytes32 indexed txHashOnXRP, uint256 amount);

  event IssuanceCompleted(bytes32 indexed txHashOnXRP, uint256 amount);
  /////////////////////////////////////////
  // Modifiers
  /////////////////////////////////////////
  modifier issuanceExists(string calldata issuer) {
    require(
      issuances[issuer].sender != address(0),
      "This issuer does not exists"
    );
    _;
  }

  modifier issuanceDoesNotExists(string calldata issuer) {
    require(
      issuances[issuer].sender == address(0),
      "This issuer already exists "
    );
    _;
  }

  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////
  /**
   *        0 = IN_PROGRESS (AUR is locked but user have not issued on XRPL yet)
   *        1 = CANCELLED (AUR is no longer held and user have cancel the issuance)
   *        2 = COMPLETE (Issuance is complete but have not proven that they can no longer issue more AUR,
   *               meaning the client side should validate more before accepting) **
   *        3 = VERIFIED (no need for more validation)
   *        4 = REDEEMED (all the AUR issued has already been REDEEMED, so this issuer is no longer valid)
   *        5 = FRAUD (The issuer address have been verified to have more than 1 issuance thus no longer valid)
   **/
  enum IssuanceStatus {
    IN_PROGRESS,
    CANCELED,
    COMPLETE,
    VERIFIED,
    REDEEMED,
    FRAUD
  }

  struct Redemption {
    string source;
    string destination;
    uint64 destinationTag;
    uint64 amount;
    address AURreleaseAddress;
    address redeemer;
  }

  struct Issuance {
    uint256 amount;
    address sender;
    bytes32 txHashOnXRP;
    IssuanceStatus status;
  }

  IAurei aurei;

  // since stateConnector is set at Flare's Genesis, we can just hard code it in the contract
  IStateConnector stateConnector =
    IStateConnector(0x1000000000000000000000000000000000000001);

  // txID to redemption event, note redemption doesn't necessarily will release all AUR from that issuer
  mapping(bytes32 => Redemption) public redemptions;
  // issuer address to the amount Issuance struct
  mapping(string => Issuance) public issuances;

  /////////////////////////////////////////
  // Constructor
  /////////////////////////////////////////
  constructor(address aureiAddress) {
    aurei = IAurei(aureiAddress);
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
   *        1 = CANCELLED (AUR is no longer held and user have cancel the issuance) 
   *        2 = COMPLETE (Issuance is complete but have not proven that they can no longer issue more AUR, 
                  meaning the client side should validate more before accepting) **
   *        3 = VERIFIED (no need for more validation)
   *        4 = REDEEMED (all the AUR issued has already been REDEEMED, so this issuer is no longer valid)
   *  **this is a stop gap before the verification is implemented in stateConnector contract
  **/
  function checkIssuerStatus(string calldata issuer)
    external
    view
    issuanceExists(issuer)
    returns (IssuanceStatus status)
  {
    return issuances[issuer].status;
  }

  /**
   * @dev Lock up AUR for new Issuance
   *
   * This function locks up and AUR and allow user to issue AUR of the same amount on XRPL
   * from the provided xrpAddress
   *
   * @param xrpAddress the XRPL address of the issuer
   * @param amount the amount of AUR to lock up and also issue on the XRPL
   **/
  function createIssuance(string calldata xrpAddress, uint256 amount)
    external
    issuanceDoesNotExists(xrpAddress)
  {
    aurei.transferFrom(msg.sender, address(this), amount);
    issuances[xrpAddress].amount = amount;
    issuances[xrpAddress].sender = msg.sender;
    issuances[xrpAddress].status = IssuanceStatus.IN_PROGRESS;
  }

  /**
   * @dev Cancel an issuance and release the AUR locked up associated with the issuance
   * The user canceling the issuance must be the same user that initiated the createIssuance
   *
   * @param issuerAddress issuerAddress on XRP
   **/
  function cancelIssuance(string calldata issuerAddress) external {
    // check that the issuance is IN_PROGRESS or fail
    require(
      issuances[issuerAddress].status == IssuanceStatus.IN_PROGRESS,
      "This issuance is no longer in progress, therefore it can not be cancelled"
    );
    // check that sender is the msg.sender
    require(
      issuances[issuerAddress].sender == msg.sender,
      "Only the original sender of the is issuance can cancel it"
    );

    // refund AUR to the msg.sender
    aurei.transfer(msg.sender, issuances[issuerAddress].amount);

    issuances[issuerAddress].status = IssuanceStatus.CANCELED;
  }

  /**
   * @dev Prove that the AUR issuance on XRPL has completed so that the issuer address can be marked as valid issuer
   *      by marking the issuer Address as COMPLETE
   *
   * @param txID the payment tx ID from XRPL
   * @param sourceHash the keccak256 hash of source address in the tx
   * @param destination address of the tx
   * @param destinationTag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function completeIssuance(
    bytes32 txID,
    bytes32 sourceHash,
    string calldata destination,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) external {
    require(
      issuances[destination].status == IssuanceStatus.IN_PROGRESS,
      "Only IN PROGRESS issuance can be completed"
    );
    verifyPaymentFinality(
      txID,
      sourceHash,
      keccak256(abi.encodePacked(destination)),
      destinationTag,
      amount,
      currencyHash
    );

    issuances[destination].txHashOnXRP = txID;
    issuances[destination].status = IssuanceStatus.COMPLETE;
    emit IssuanceCompleted(txID, amount);
  }

  /**
   * @dev every issuer address is only allowed to do One issuance, by proving the 2nd issuance from the account,
   *      you can prove that the issuer account is no longer legit and can be consider fraudulent
   *      the one who submit the proof will be given a reward from some of the AUR that has been locked in by the
   *      issuer address
   *
   * @param txID the payment tx ID from XRPL
   * @param sourceHash the keccak256 hash of source address in the tx
   * @param destination the destination address of the tx
   * @param destinationTag the destination Tag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function proveFraud(
    bytes32 txID,
    bytes32 sourceHash,
    string calldata destination,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) external {
    require(
      issuances[destination].txHashOnXRP != txID,
      "The provided txID has already proven"
    );
    verifyPaymentFinality(
      txID,
      sourceHash,
      keccak256(abi.encodePacked(destination)),
      destinationTag,
      amount,
      currencyHash
    );

    issuances[destination].status = IssuanceStatus.FRAUD;
    // send all of the AUR to the sender of this call as reward
    aurei.transfer(msg.sender, issuances[destination].amount);
  }

  /**
   * @dev Pre-register a redemption attempt, this will allow the msg.sender to be the only that can prove tx to redeem
   *      and specify the destination to where the AUR will be released
   *
   * @param source the source address in the tx
   * @param destination the destination address of the tx
   * @param destinationTag the destination Tag of tx
   **/
  function redemptionAttempt(
    string calldata source,
    string calldata destination,
    uint64 destinationTag
  ) external {
    bytes32 redemptionHash =
      keccak256(abi.encode(source, destination, destinationTag));

    redemptions[redemptionHash].source = source;
    redemptions[redemptionHash].destination = destination;
    redemptions[redemptionHash].destinationTag = destinationTag;
    redemptions[redemptionHash].redeemer = msg.sender;
  }

  /**
   * @dev Prove that the AUR has been sent back to issuer on XRPL and the contract will release the AUR in the same
   *      amount sent.
   *
   * @param txID the payment tx ID from XRPL
   * @param source the source address in the tx
   * @param destination the destination address of the tx
   * @param destinationTag the destination Tag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function completeRedemption(
    bytes32 txID,
    string calldata source,
    string calldata destination,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash,
    address destAddress
  ) external {
    bytes32 redemptionHash =
      keccak256(abi.encode(source, destination, destinationTag));
    require(
      redemptions[redemptionHash].redeemer == msg.sender,
      "Only the user that submitted the redemption attempt can submit redemption tx"
    );

    verifyPaymentFinality(
      txID,
      keccak256(abi.encodePacked(destination)),
      keccak256(abi.encodePacked(destination)),
      destinationTag,
      amount,
      currencyHash
    );
    aurei.transfer(destAddress, amount);
    redemptions[redemptionHash].amount = amount;
    redemptions[redemptionHash].AURreleaseAddress = destAddress;

    emit RedemptionCompleted(txID, amount);
  }

  /**
   * @dev The final step in issuance is to prove that Issuer can no longer issue anymore AUR, making it verified that
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
   * @dev Prove that the AUR issuance on XRPL has completed so that the issuer address can be marked as valid issuer
   *
   * @param txID the payment tx ID from XRPL
   * @param sourceHash the keccak256 hash of source address in the tx
   * @param destinationHash the keccak256 hash of destination address of the tx
   * @param destinationTag the destination Tag of tx
   * @param amount sent in tx
   * @param currencyHash hash of the currency code
   **/
  function verifyPaymentFinality(
    bytes32 txID,
    bytes32 sourceHash,
    bytes32 destinationHash,
    uint64 destinationTag,
    uint64 amount,
    bytes32 currencyHash
  ) internal {
    (, , bool isFinal) =
      stateConnector.getPaymentFinality(
        uint32(0),
        txID,
        sourceHash,
        destinationHash,
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
