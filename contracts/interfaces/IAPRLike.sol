pragma solidity 0.8.4;

interface IAPRLike {
    // solhint-disable-next-line
    function APR_TO_MPR(uint256 APR) external returns (uint256);
}
