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

  /***********************************|
  |        Liquidity Functions        |
  |__________________________________*/

  /**
   * @notice Deposit ETH && Tokens (token) at current ratio to mint UNI tokens.
   * @dev min_liquidity does nothing when total UNI supply is 0.
   * @param min_liquidity Minimum number of UNI sender will mint if total UNI supply is greater than 0.
   * @param max_tokens Maximum number of tokens deposited. Deposits max amount if total UNI supply is 0.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return The amount of UNI minted.
   */
  function addLiquidity(
    uint256 min_liquidity,
    uint256 max_tokens,
    uint256 deadline
  ) external payable returns (uint256);

  /**
   * @dev Burn UNI tokens to withdraw ETH && Tokens at current ratio.
   * @param amount Amount of UNI burned.
   * @param min_eth Minimum ETH withdrawn.
   * @param min_tokens Minimum Tokens withdrawn.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return The amount of ETH && Tokens withdrawn.
   */
  function removeLiquidity(
    uint256 amount,
    uint256 min_eth,
    uint256 min_tokens,
    uint256 deadline
  ) external returns (uint256, uint256);
}
