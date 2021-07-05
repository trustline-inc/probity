const errorTypes = {
  ISSUER_EXISTS: "This issuer already exists",
  ISSUER_NOT_EXISTS: "This issuer does not exists",
  ISSUER_NOT_IN_PROGRESS: "issuer status is not longer IN_PROGRESS",
  ONLY_ORIGINAL_SENDER:
    "Only the original sender of the is issuer can cancel it",
  NON_ZERO_AMOUNT: "amount must be a non zero amount",
  AUR_NO_BALANCE: "ERC20: transfer amount exceeds balance",
  TX_ID_ALREADY_PROVEN: "The provided txHash has already proven",
  TX_ID_ALREADY_REDEEMED: "This txHash has already been redeemed",
  TWO_HOURS_NOT_PASSED:
    "The previous redemption attempt for this parameter was submitted less than 2 hours ago",
  NON_ZERO_DESTINATION_ADDRESS: "Destination address can not be zero Address",
  ONLY_REDEEMER:
    "Only the user that submitted the redemption attempt can submit redemption tx",
  PAYMENT_NOT_PROVEN:
    "This Transaction has not been proven in stateConnector contract",
};
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
const BYTES32_ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export { errorTypes, ADDRESS_ZERO, BYTES32_ZERO };
