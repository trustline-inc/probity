pragma solidity ^0.8.0;

contract MockBondIssuer {
    struct LastShutdownRedemptionCall {
        address user;
        uint256 amount;
    }

    LastShutdownRedemptionCall public lastRedemptionCall;
    mapping(bytes32 => bool) public states;
    mapping(address => uint256) public tokens;
    uint256 public totalTokens;
    uint256 public lastReduceAuctionDebtAmount;
    uint256 public lastAddAuctionDebtAmount;
    uint256 public lastOfferingAmount;

    function setTokens(address user, uint256 amount) external {
        tokens[user] = amount;
    }

    function setTotalTokens(uint256 newTotal) external {
        totalTokens = newTotal;
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

    function newOffering(uint256 amount) external {
        lastOfferingAmount = amount;
    }
}
