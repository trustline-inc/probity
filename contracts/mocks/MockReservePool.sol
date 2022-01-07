pragma solidity ^0.8.0;

contract MockReservePool {
    struct LastShutdownRedemptionCall {
        address user;
        uint256 amount;
    }

    LastShutdownRedemptionCall public lastRedemptionCall;
    mapping(bytes32 => bool) public states;
    mapping(address => uint256) public shares;
    uint256 public totalShares;
    uint256 public lastReduceAuctionDebtAmount;
    uint256 public lastAddAuctionDebtAmount;

    function setShares(address user, uint256 amount) external {
        shares[user] = amount;
    }

    function setTotalShares(uint256 newTotal) external {
        totalShares = newTotal;
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
