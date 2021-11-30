pragma solidity ^0.8.0;

contract MockReservePool {
    struct LastShutdownRedemptionCall {
        address user;
        uint256 amount;
    }

    LastShutdownRedemptionCall public lastRedemptionCall;
    mapping(bytes32 => bool) public states;
    mapping(address => uint256) public ious;
    uint256 public totalIous;

    function setIous(address user, uint256 amount) external {
        ious[user] = amount;
    }

    function setTotalIous(uint256 newTotal) external {
        totalIous = newTotal;
    }

    function shutdownRedemption(address user, uint256 amount) external {
        lastRedemptionCall = LastShutdownRedemptionCall(user, amount);
    }

    function setShutdownState() external {
        states["shutdown"] = true;
    }
}
