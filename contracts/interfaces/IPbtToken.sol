// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IERC2612.sol";

/**
 * @notice Common interface for the PBT token.
 */
interface IPbtToken is IERC20 {
    // --- Events ---

    // --- Functions ---

    function mint(address _account, uint256 _amount) external;

    function burn(address _account, uint256 _amount) external;
}
