// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface IBondIssuerLike {
    function newOffering(uint256 amount) external;
}
