const errorTypes = {
  ISSUER_EXISTS: "An issuer already exists with this address.",
  ISSUER_NON_EXISTENT: "The issuer does not exist.",
  ISSUER_NOT_PENDING: "The issuer is not in the PENDING state.",
  ONLY_ORIGINAL_SENDER: "Only the originating account can cancel this issuer.",
  NON_ZERO_AMOUNT: "Amount must be greater than zero.",
  AUR_NO_BALANCE: "ERC20: transfer amount exceeds balance",
  TX_ID_ALREADY_PROVEN: "The provided transaction is already proved.",
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
