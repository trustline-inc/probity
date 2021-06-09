// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./libraries/Base.sol";
import "./interfaces/IAurei.sol";
import "./interfaces/IAureiMarket.sol";
import "./interfaces/IMarketFactory.sol";
import "./interfaces/IRegistry.sol";
import "./libraries/Ownable.sol";
import "./tokens/PeggedERC20.sol";

/**
 * @notice adapted from UniSwap V1
 */
contract AureiMarket is IAureiMarket, PeggedERC20 {
  using SafeMath for uint256;

  /// @dev Interface for Aurei token
  IAurei aurei;

  /// @dev Interface for the factory that created this contract
  IMarketFactory factory;

  /// @dev Used to get addresses of other ARS contracts
  IRegistry registry;

  /// @dev Address of the ERC20 token traded on this contract
  IERC20 token;

  // --- Constructor ---

  /**
   * @notice Intial setup of an Aurei market.
   * @param tokenAddress - Address of ERC20 token.
   * @dev This is called once by the factory after contract creation.
   */
  function setup(address tokenAddress, address _registry) public {
    require(
      address(factory) == address(0) &&
        address(token) == address(0) &&
        tokenAddress != address(0),
      "INVALID_ADDRESS"
    );
    factory = IMarketFactory(msg.sender);
    token = IERC20(tokenAddress);
    registry = IRegistry(_registry);
  }

  /**
   * @notice Fallback function converts FLR to AUR.
   * @dev User specifies exact input (msg.value).
   * @dev User cannot specify minimum output or deadline.
   */
  fallback() external payable {
    flrToAurInput(msg.value, 1, block.timestamp, msg.sender, msg.sender);
  }

  /**
   * @dev Pricing function for converting between FLR and AUR.
   * @param input_amount Amount of FLR or AUR being sold.
   * @param input_reserve Amount of FLR or AUR (input type) in exchange reserves.
   * @param output_reserve Amount of FLR or AUR (output type) in exchange reserves.
   * @return Amount of FLR or AUR bought.
   */
  function getInputPrice(
    uint256 input_amount,
    uint256 input_reserve,
    uint256 output_reserve
  ) public view returns (uint256) {
    require(input_reserve > 0 && output_reserve > 0, "INVALID_VALUE");
    uint256 input_amount_with_fee = input_amount.mul(997);
    uint256 numerator = input_amount_with_fee.mul(output_reserve);
    uint256 denominator = input_reserve.mul(1000).add(input_amount_with_fee);
    return numerator / denominator;
  }

  /**
   * @dev Pricing function for converting between FLR and AUR.
   * @param output_amount Amount of FLR or AUR being bought.
   * @param input_reserve Amount of FLR or AUR (input type) in exchange reserves.
   * @param output_reserve Amount of FLR or AUR (output type) in exchange reserves.
   * @return Amount of FLR or AUR sold.
   */
  function getOutputPrice(
    uint256 output_amount,
    uint256 input_reserve,
    uint256 output_reserve
  ) public view returns (uint256) {
    require(input_reserve > 0 && output_reserve > 0);
    uint256 numerator = input_reserve.mul(output_amount).mul(1000);
    uint256 denominator = (output_reserve.sub(output_amount)).mul(997);
    return (numerator / denominator).add(1);
  }

  function flrToAurInput(
    uint256 flr_sold,
    uint256 min_aur,
    uint256 deadline,
    address buyer,
    address recipient
  ) private returns (uint256) {
    require(deadline >= block.timestamp && flr_sold > 0 && min_aur > 0);
    uint256 aur_reserve = aurei.balanceOf(address(this));
    uint256 aur_bought =
      getInputPrice(flr_sold, address(this).balance.sub(flr_sold), aur_reserve);
    require(aur_bought >= min_aur);
    require(aurei.transfer(recipient, aur_bought));
    emit AureiPurchase(buyer, flr_sold, aur_bought);
    return aur_bought;
  }

  /**
   * @notice Convert FLR to AUR.
   * @dev User specifies exact input (msg.value) && minimum output.
   * @param min_aur Minimum AUR bought.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return Amount of AUR bought.
   */
  function flrToAurSwapInput(uint256 min_aur, uint256 deadline)
    public
    payable
    returns (uint256)
  {
    return flrToAurInput(msg.value, min_aur, deadline, msg.sender, msg.sender);
  }

  /**
   * @notice Convert FLR to AUR && transfers AUR to recipient.
   * @dev User specifies exact input (msg.value) && minimum output
   * @param min_aur Minimum AUR bought.
   * @param deadline Time after which this transaction can no longer be executed.
   * @param recipient The address that receives output AUR.
   * @return  Amount of AUR bought.
   */
  function flrToAurTransferInput(
    uint256 min_aur,
    uint256 deadline,
    address recipient
  ) public payable returns (uint256) {
    require(recipient != address(this) && recipient != address(0));
    return flrToAurInput(msg.value, min_aur, deadline, msg.sender, recipient);
  }

  function flrToAurOutput(
    uint256 aur_bought,
    uint256 max_flr,
    uint256 deadline,
    address payable buyer,
    address recipient
  ) private returns (uint256) {
    require(deadline >= block.timestamp && aur_bought > 0 && max_flr > 0);
    uint256 aur_reserve = aurei.balanceOf(address(this));
    uint256 flr_sold =
      getOutputPrice(
        aur_bought,
        address(this).balance.sub(max_flr),
        aur_reserve
      );
    // Throws if flr_sold > max_flr
    uint256 flr_refund = max_flr.sub(flr_sold);
    if (flr_refund > 0) {
      buyer.transfer(flr_refund);
    }
    require(aurei.transfer(recipient, aur_bought));
    emit AureiPurchase(buyer, flr_sold, aur_bought);
    return flr_sold;
  }

  /**
   * @notice Convert FLR to AUR.
   * @dev User specifies maximum input (msg.value) && exact output.
   * @param aur_bought Amount of AUR bought.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return Amount of FLR sold.
   */
  function flrToAurSwapOutput(uint256 aur_bought, uint256 deadline)
    public
    payable
    returns (uint256)
  {
    return
      flrToAurOutput(
        aur_bought,
        msg.value,
        deadline,
        payable(msg.sender),
        msg.sender
      );
  }

  /**
   * @notice Convert FLR to AUR && transfers AUR to recipient.
   * @dev User specifies maximum input (msg.value) && exact output.
   * @param aur_bought Amount of AUR bought.
   * @param deadline Time after which this transaction can no longer be executed.
   * @param recipient The address that receives output AUR.
   * @return Amount of FLR sold.
   */
  function flrToAurTransferOutput(
    uint256 aur_bought,
    uint256 deadline,
    address recipient
  ) public payable returns (uint256) {
    require(recipient != address(this) && recipient != address(0));
    return
      flrToAurOutput(
        aur_bought,
        msg.value,
        deadline,
        payable(msg.sender),
        recipient
      );
  }

  function aurToFlrInput(
    uint256 aur_sold,
    uint256 min_flr,
    uint256 deadline,
    address buyer,
    address payable recipient
  ) private returns (uint256) {
    require(deadline >= block.timestamp && aur_sold > 0 && min_flr > 0);
    uint256 aur_reserve = aurei.balanceOf(address(this));
    uint256 flr_bought =
      getInputPrice(aur_sold, aur_reserve, address(this).balance);
    uint256 wei_bought = flr_bought;
    require(wei_bought >= min_flr);
    recipient.transfer(wei_bought);
    require(aurei.transferFrom(buyer, address(this), aur_sold));
    emit FlrPurchase(buyer, aur_sold, wei_bought);
    return wei_bought;
  }

  /**
   * @notice Convert AUR to FLR.
   * @dev User specifies exact input && minimum output.
   * @param aur_sold Amount of AUR sold.
   * @param min_flr Minimum FLR purchased.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return Amount of FLR bought.
   */
  function aurToFlrSwapInput(
    uint256 aur_sold,
    uint256 min_flr,
    uint256 deadline
  ) public returns (uint256) {
    return
      aurToFlrInput(
        aur_sold,
        min_flr,
        deadline,
        msg.sender,
        payable(msg.sender)
      );
  }

  /**
   * @notice Convert AUR to FLR && transfers FLR to recipient.
   * @dev User specifies exact input && minimum output.
   * @param aur_sold Amount of AUR sold.
   * @param min_flr Minimum FLR purchased.
   * @param deadline Time after which this transaction can no longer be executed.
   * @param recipient The address that receives output FLR.
   * @return  Amount of FLR bought.
   */
  function aurToFlrTransferInput(
    uint256 aur_sold,
    uint256 min_flr,
    uint256 deadline,
    address payable recipient
  ) public returns (uint256) {
    require(recipient != address(this) && recipient != address(0));
    return aurToFlrInput(aur_sold, min_flr, deadline, msg.sender, recipient);
  }

  function aurToFlrOutput(
    uint256 flr_bought,
    uint256 max_aur,
    uint256 deadline,
    address buyer,
    address payable recipient
  ) private returns (uint256) {
    require(deadline >= block.timestamp && flr_bought > 0);
    uint256 aur_reserve = aurei.balanceOf(address(this));
    uint256 aur_sold =
      getOutputPrice(flr_bought, aur_reserve, address(this).balance);
    // AUR sold is always > 0
    require(max_aur >= aur_sold);
    recipient.transfer(flr_bought);
    require(aurei.transferFrom(buyer, address(this), aur_sold));
    emit FlrPurchase(buyer, aur_sold, flr_bought);
    return aur_sold;
  }

  /**
   * @notice Convert AUR to FLR.
   * @dev User specifies maximum input && exact output.
   * @param flr_bought Amount of FLR purchased.
   * @param max_aur Maximum AUR sold.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return Amount of AUR sold.
   */
  function aurToFlrSwapOutput(
    uint256 flr_bought,
    uint256 max_aur,
    uint256 deadline
  ) public returns (uint256) {
    return
      aurToFlrOutput(
        flr_bought,
        max_aur,
        deadline,
        msg.sender,
        payable(msg.sender)
      );
  }

  /**
   * @notice Convert AUR to FLR && transfers FLR to recipient.
   * @dev User specifies maximum input && exact output.
   * @param flr_bought Amount of FLR purchased.
   * @param max_aur Maximum AUR sold.
   * @param deadline Time after which this transaction can no longer be executed.
   * @param recipient The address that receives output FLR.
   * @return Amount of AUR sold.
   */
  function aurToFlrTransferOutput(
    uint256 flr_bought,
    uint256 max_aur,
    uint256 deadline,
    address payable recipient
  ) public returns (uint256) {
    require(recipient != address(this) && recipient != address(0));
    return aurToFlrOutput(flr_bought, max_aur, deadline, msg.sender, recipient);
  }

  /***********************************|
  |        Liquidity Functions        |
  |__________________________________*/

  /**
   * @notice Deposit FLR && AUR at current ratio to mint PEG tokens.
   * @dev min_liquidity does nothing when total PEG supply is 0.
   * @param min_liquidity Minimum number of PEG sender will mint if total PEG supply is greater than 0.
   * @param max_tokens Maximum number of tokens deposited. Deposits max amount if total PEG supply is 0.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return The amount of PEG minted.
   */
  function addLiquidity(
    uint256 min_liquidity,
    uint256 max_tokens,
    uint256 deadline
  ) public payable onlyTreasury returns (uint256) {
    require(
      deadline > block.timestamp && max_tokens > 0 && msg.value > 0,
      "AureiMarket#addLiquidity: INVALID_ARGUMENT"
    );
    uint256 total_liquidity = _totalSupply;

    if (total_liquidity > 0) {
      require(min_liquidity > 0);
      uint256 flr_reserve = address(this).balance.sub(msg.value);
      uint256 aur_reserve = aurei.balanceOf(address(this));
      uint256 aur_amount = (msg.value.mul(aur_reserve) / flr_reserve).add(1);
      uint256 liquidity_minted = msg.value.mul(total_liquidity) / flr_reserve;
      require(max_tokens >= aur_amount && liquidity_minted >= min_liquidity);
      _balances[msg.sender] = _balances[msg.sender].add(liquidity_minted);
      _totalSupply = total_liquidity.add(liquidity_minted);
      require(token.transferFrom(msg.sender, address(this), aur_amount));
      emit AddLiquidity(msg.sender, msg.value, aur_amount);
      emit Transfer(address(0), msg.sender, liquidity_minted);
      return liquidity_minted;
    } else {
      require(
        address(factory) != address(0) &&
          address(token) != address(0) &&
          msg.value >= 1000000000,
        "INVALID_VALUE"
      );
      require(factory.getExchange(address(token)) == address(this));
      uint256 aur_amount = max_tokens;
      uint256 initial_liquidity = address(this).balance;
      _totalSupply = initial_liquidity;
      _balances[msg.sender] = initial_liquidity;
      require(token.transferFrom(msg.sender, address(this), aur_amount));
      emit AddLiquidity(msg.sender, msg.value, aur_amount);
      emit Transfer(address(0), msg.sender, initial_liquidity);
      return initial_liquidity;
    }
  }

  /**
   * @dev Burn PEG tokens to withdraw FLR && AUR at current ratio.
   * @param amount Amount of PEG burned.
   * @param min_flr Minimum FLR withdrawn.
   * @param min_tokens Minimum AUR withdrawn.
   * @param deadline Time after which this transaction can no longer be executed.
   * @return The amount of FLR && AUR withdrawn.
   */
  function removeLiquidity(
    uint256 amount,
    uint256 min_flr,
    uint256 min_tokens,
    uint256 deadline
  ) public onlyTreasury returns (uint256, uint256) {
    require(
      amount > 0 && deadline > block.timestamp && min_flr > 0 && min_tokens > 0
    );
    uint256 total_liquidity = _totalSupply;
    require(total_liquidity > 0);
    uint256 aur_reserve = aurei.balanceOf(address(this));
    uint256 flr_amount = amount.mul(address(this).balance) / total_liquidity;
    uint256 aur_amount = amount.mul(aur_reserve) / total_liquidity;
    require(flr_amount >= min_flr && aur_amount >= min_tokens);

    _balances[msg.sender] = _balances[msg.sender].sub(amount);
    _totalSupply = total_liquidity.sub(amount);
    payable(msg.sender).transfer(flr_amount);
    require(token.transfer(msg.sender, aur_amount));
    emit RemoveLiquidity(msg.sender, flr_amount, aur_amount);
    emit Transfer(msg.sender, address(0), amount);
    return (flr_amount, aur_amount);
  }

  /**
   * @dev Ensure that msg.sender === Treasury contract address.
   */
  modifier onlyTreasury {
    require(
      msg.sender == registry.getContractAddress(Base.Contract.Treasury),
      "AUREI_MARKET: Only Treasury can call this method."
    );
    _;
  }
}
