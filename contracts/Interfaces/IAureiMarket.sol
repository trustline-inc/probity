// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @notice Incentivized exchange market.
 */
interface IAureiMarket {
  // --- Events ---

  event AureiPurchase(
    address indexed buyer,
    uint256 indexed sparkSold,
    uint256 indexed aureiBought
  );
  event FlrPurchase(
    address indexed buyer,
    uint256 indexed aureiSold,
    uint256 indexed sparkbought
  );
  event AddLiquidity(
    address indexed provider,
    uint256 indexed sparkAmount,
    uint256 indexed aureiAmount
  );
  event RemoveLiquidity(
    address indexed provider,
    uint256 indexed sparkAmount,
    uint256 indexed aureiAmount
  );
}
