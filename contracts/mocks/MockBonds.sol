pragma solidity ^0.8.0;

contract MockBonds {
    struct LastShutdownRedemptionCall {
        address user;
        uint256 amount;
    }

    LastShutdownRedemptionCall public lastRedemptionCall;
    mapping(bytes32 => bool) public states;
    mapping(address => uint256) public vouchers;
    uint256 public totalVouchers;
    uint256 public lastReduceAuctionDebtAmount;
    uint256 public lastAddAuctionDebtAmount;

    function setVouchers(address user, uint256 amount) external {
        vouchers[user] = amount;
    }

    function setTotalVouchers(uint256 newTotal) external {
        totalVouchers = newTotal;
    }

    function shutdownRedemption(address user, uint256 amount) external {
        lastRedemptionCall = LastShutdownRedemptionCall(user, amount);
    }

    function setShutdownState() external {
        states["shutdown"] = true;
    }

    function reduceAuctionDebt(uint256 amount) external {
        lastReduceAuctionDebtAmount = amount;
    }

    function addAuctionDebt(uint256 amount) external {
        lastAddAuctionDebtAmount = amount;
    }
}
