// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./libraries/Base.sol";
import "./libraries/Ownable.sol";
import "./interfaces/IMarketFactory.sol";
import "./interfaces/IRegistry.sol";
import "./AureiMarket.sol";
import "hardhat/console.sol";

contract MarketFactory is IMarketFactory, Base, Ownable {
  /***********************************|
  |       Events And Variables        |
  |__________________________________*/

  IRegistry public registry;
  uint256 public tokenCount;
  mapping(address => address) internal token_to_exchange;
  mapping(address => address) internal exchange_to_token;
  mapping(uint256 => address) internal id_to_token;

  /***********************************|
  |         Factory Functions         |
  |__________________________________*/

  constructor(address _registry) Ownable(msg.sender) {
    registry = IRegistry(_registry);
  }

  function createExchange(address token)
    public
    override
    returns (address payable)
  {
    require(token != address(0));
    require(token_to_exchange[token] == address(0));
    AureiMarket exchange = new AureiMarket();
    exchange.setup(token, address(registry));
    token_to_exchange[token] = address(exchange);
    exchange_to_token[address(exchange)] = token;
    uint256 token_id = tokenCount + 1;
    tokenCount = token_id;
    id_to_token[token_id] = token;
    emit NewExchange(token, address(exchange));
    return payable(address(exchange));
  }

  /***********************************|
  |         Getter Functions          |
  |__________________________________*/

  function getExchange(address token)
    public
    view
    override
    returns (address payable)
  {
    return payable(token_to_exchange[token]);
  }

  function getToken(address exchange) public view override returns (address) {
    return exchange_to_token[exchange];
  }

  function getTokenWithId(uint256 token_id)
    public
    view
    override
    returns (address)
  {
    return id_to_token[token_id];
  }
}
