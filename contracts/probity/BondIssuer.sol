pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function stablecoin(address user) external returns (uint256 balance);

    function systemDebt(address user) external returns (uint256 balance);

    function settle(uint256 balance) external;

    function increaseSystemDebt(uint256 amount) external;

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;
}

/**
 * @title BondIssuer contract
 * @notice Sells zero-coupon bonds that are redeemable for excess reserves on a FIFO redemption basis.
 * @dev Tokens are redeemable for excess USD reserves at a 1:1 rate (with max precision of 1e-18).
 */
contract BondIssuer is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Offering {
        bool active;
        uint256 startTime;
        uint256 amount;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1E18;
    VaultEngineLike public immutable vaultEngine;
    address public reservePoolAddress;

    Offering public offering;

    // Every saleStepPeriod, tokens received per stablecoin goes up by X% until maxDiscount
    uint256 public discountIncreasePerStep = 5E16; // 5%
    uint256 public saleStepPeriod = 6 hours;
    uint256 public maxDiscount = 1.5E18; // 150% of stablecoin (50% discount)

    mapping(address => uint256) public tokens;
    uint256 public totalTokens;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address registryAddress, VaultEngineLike vaultEngineAddress) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
    }

    /////////////////////////////////////////
    // Public functions
    /////////////////////////////////////////
    /**
     * @notice Returns the amount of tokens received per stablecoin
     * @dev Stepwise discount increases until max discount is met
     */
    function tokensPerStablecoin() public view returns (uint256 discount) {
        uint256 steps = (block.timestamp - offering.startTime) / saleStepPeriod;

        if (ONE + (discountIncreasePerStep * steps) > maxDiscount) {
            return maxDiscount;
        } else {
            return ONE + (discountIncreasePerStep * steps);
        }
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @notice set the address of the reservePool
     * @param _reservePoolAddress reservePoolAddress
     */
    function setReservePoolAddress(address _reservePoolAddress) external onlyBy("gov") {
        require(reservePoolAddress == address(0), "BondIssuer/setReservePoolAddress: reservePool Address already set");
        reservePoolAddress = _reservePoolAddress;
    }

    /**
     * @notice Updates the maximum discount for a sale
     * @param newMaxDiscount The maximum discount to set
     */
    function updateSaleMaxDiscount(uint256 newMaxDiscount) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "maxDiscount", maxDiscount, newMaxDiscount);
        maxDiscount = newMaxDiscount;
    }

    /**
     * @notice Updates the sale step period
     * @param newStepPeriod The new period of time per step
     */
    function updateSaleStepPeriod(uint256 newStepPeriod) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "saleStepPeriod", saleStepPeriod, newStepPeriod);
        saleStepPeriod = newStepPeriod;
    }

    /**
     * @notice Updates the sale discount increase per step
     * @param newPriceIncreasePerStep The new discount increase per step
     */
    function updateSalePriceIncreasePerStep(uint256 newPriceIncreasePerStep) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "discountIncreasePerStep", discountIncreasePerStep, newPriceIncreasePerStep);
        discountIncreasePerStep = newPriceIncreasePerStep;
    }

    /**
     * @notice new offering to be sold
     * @param amount to be sold
     */
    function newOffering(uint256 amount) external onlyBy("reservePool") {
        require(offering.active == false, "ReservePool/startSale: the current offering is not over yet");

        offering.active = true;
        offering.startTime = block.timestamp;
        offering.amount = amount;
    }

    /**
     * @notice Processes a redemption when the system is in shut down state
     * @param user The user to process for
     * @param amount The amount to redeem
     */
    function shutdownRedemption(address user, uint256 amount) external onlyWhen("shutdown", true) onlyBy("shutdown") {
        processRedemption(user, amount);
    }

    /**
     * @notice Purchases a bond
     * @param value The bond face value
     */
    function purchaseBond(uint256 value) external {
        require(offering.active, "ReservePool/purchaseBond: tokens are not currently on sale");
        require(offering.amount >= value, "ReservePool/purchaseBond: Can't purchase more tokens than offering value");

        vaultEngine.moveStablecoin(msg.sender, reservePoolAddress, value);
        uint256 amountToBuy = ((value * tokensPerStablecoin()) / ONE);
        tokens[msg.sender] += amountToBuy;
        totalTokens += amountToBuy;
        offering.amount = offering.amount - value;
        if (offering.amount == 0) {
            offering.active = false;
        }
    }

    /**
     * @notice Redeems tokens for assets
     * @param amount The amount to redeem
     */
    function redeemBonds(uint256 amount) external {
        processRedemption(msg.sender, amount);
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////

    /**
     * @notice Processes a redemption
     * @param user The user to process a redemption for
     * @param amount The amount to redeem
     */
    function processRedemption(address user, uint256 amount) internal {
        require(
            vaultEngine.stablecoin(address(reservePoolAddress)) - vaultEngine.systemDebt(address(reservePoolAddress)) >=
                amount,
            "ReservePool/processRedemption: The reserve pool doesn't have enough funds"
        );

        require(
            tokens[user] >= amount,
            "ReservePool/processRedemption: User doesn't have enough tokens to redeem this amount"
        );

        tokens[user] -= amount;
        vaultEngine.moveStablecoin(address(reservePoolAddress), user, amount);
    }
}
