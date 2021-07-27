pragma solidity ^0.8.0;

interface PriceCalc {
  function price(uint256 startingPrice, uint256 timeElapsed)
    external
    returns (uint256 price);
}

contract LinearDecrease is PriceCalc {
  /////////////////////////////////////////
  // Data Storage
  /////////////////////////////////////////

  uint256 timeToZero = 2 days;
  uint256 constant RAY = 10**27;

  /////////////////////////////////////////
  // External Functions
  /////////////////////////////////////////

  function price(uint256 startingPrice, uint256 timeElapsed)
    external
    override
    returns (uint256 price)
  {
    if (timeElapsed >= timeToZero) return 0;
    return rmul(startingPrice, mul(timeToZero - timeElapsed, RAY) / timeToZero);
  }

  /////////////////////////////////////////
  // Internal Functions
  /////////////////////////////////////////

  function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
    require((c = a + b) >= a);
  }

  function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    require(b == 0 || (c = a * b) / b == a);
  }

  function rmul(uint256 a, uint256 b) internal pure returns (uint256 c) {
    c = a * b;
    require(b == 0 || c / b == a);
    c = c / RAY;
  }
}
