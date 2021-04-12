// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Interfaces/IAurei.sol";

/**
 * This contract acts as a trustless bridge for Aurei between Flare and the XRPL.
 * https://blog.flare.xyz/closing-the-circle-on-xrp-flare-interoperability/
 *
 * This contract is designed to achieve 3 things:
 * a) Penalize Alice if she follows the issuance process incorrectly.
 * b) Safely hold the USF such that it is available for redemption to any Flare address upon demand. (See redemption below)
 * c) Maintain a list of valid XRPL issuer accounts.
 */
contract Bridge {
  IAurei public aurei;

  // Array of valid XRPL addresses

  // User first gives this contract an allowance
  function lock(uint256 amount, string memory issuerAddress) public {
    aurei.transferFrom(msg.sender, address(this), amount);
    // Push issuerAddress to list of valid XRPL addresses.
  }
}
