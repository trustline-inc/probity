// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../interfaces/IVaultEngineLike.sol";
import "../interfaces/IBondIssuerLike.sol";

/**
 * @title BondIssuer contract
 * @notice Sells zero-coupon bonds that are redeemable for excess reserves on a FIFO redemption basis.
 * @dev Bonds are redeemable for excess USD reserves starting at a 1:1 and up to 1:1.5 rate (precision of 1e-18).
 */
contract BondIssuer is Stateful, Eventful, IBondIssuerLike {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Offering {
        bool active;
        uint256 startTime;
        uint256 amount; // [RAD]
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant ONE = 1E18;
    IVaultEngineLike public immutable vaultEngine;
    address public reservePoolAddress;

    Offering public offering;

    // Every stepPeriod, bondTokens received per systemCurrency goes up by X% until maxDiscount
    uint256 public discountIncreasePerStep = 5E16; // 5%
    uint256 public stepPeriod = 6 hours;
    uint256 public maxDiscount = 1.5E18; // 150% of systemCurrency (50% discount)

    mapping(address => uint256) public bondTokens; // [RAD]
    uint256 public totalBondTokens; // [RAD]

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error reservePoolAlreadySet();
    error saleActive();
    error saleNotActive();
    error purchaseAmountIsHigherThanAvailable(uint256 purchaseAmount, uint256 available);
    error notEnoughBondsToRedeem(uint256 requested, uint256 userBondBalance);
    error insufficientFundsInReservePool(uint256 currentBalance);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(address registryAddress, IVaultEngineLike vaultEngineAddress) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
    }

    /////////////////////////////////////////
    // Public functions
    /////////////////////////////////////////
    /**
     * @notice Returns the amount of bondTokens received per systemCurrency
     * @dev Stepwise discount increases until max discount is met
     */
    function tokensPerSystemCurrency() public view returns (uint256 discount) {
        uint256 steps = (block.timestamp - offering.startTime) / stepPeriod;

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
        if (reservePoolAddress != address(0)) revert reservePoolAlreadySet();
        reservePoolAddress = _reservePoolAddress;
    }

    /**
     * @notice Updates the maximum discount for an issue
     * @param newMaxDiscount The maximum discount to set
     */
    function updateMaxDiscount(uint256 newMaxDiscount) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "maxDiscount", maxDiscount, newMaxDiscount);
        maxDiscount = newMaxDiscount;
    }

    /**
     * @notice Updates the step period
     * @param newStepPeriod The new period of time per step
     */
    function updateStepPeriod(uint256 newStepPeriod) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "stepPeriod", stepPeriod, newStepPeriod);
        stepPeriod = newStepPeriod;
    }

    /**
     * @notice Updates the discount increase per step
     * @param newDiscountIncreasePerStep The new discount increase per step
     */
    function updateDiscountIncreasePerStep(uint256 newDiscountIncreasePerStep) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "discountIncreasePerStep", discountIncreasePerStep, newDiscountIncreasePerStep);
        discountIncreasePerStep = newDiscountIncreasePerStep;
    }

    /**
     * @notice new offering to be sold
     * @param amount to be sold
     */
    function newOffering(uint256 amount) external override onlyBy("reservePool") {
        if (offering.active != false) revert saleActive();

        offering.active = true;
        offering.startTime = block.timestamp;
        offering.amount = amount;
    }

    /**
     * @notice Purchases a bond
     * @param value The bond face value
     */
    function purchaseBond(uint256 value) external onlyWhen("paused", false) {
        if (!offering.active) revert saleNotActive();
        if (offering.amount < value) revert purchaseAmountIsHigherThanAvailable(value, offering.amount);

        vaultEngine.moveSystemCurrency(msg.sender, reservePoolAddress, value);
        uint256 amountToBuy = ((value * tokensPerSystemCurrency()) / ONE);
        bondTokens[msg.sender] += amountToBuy;
        totalBondTokens += amountToBuy;
        offering.amount = offering.amount - value;
        if (offering.amount == 0) {
            offering.active = false;
        }
    }

    /**
     * @notice Redeems bondTokens for assets
     * @param amount The amount to redeem
     */
    function redeemBondTokens(uint256 amount) external onlyWhen("paused", false) {
        _processRedemption(msg.sender, amount);
    }

    /**
     * @notice Redeems bondTokens for assets on behalf of users
     * @param amount The amount to redeem
     */
    function redeemBondTokensForUser(address user, uint256 amount) external onlyByProbity {
        _processRedemption(user, amount);
    }

    /////////////////////////////////////////
    // Internal functions
    /////////////////////////////////////////

    /**
     * @notice Processes a redemption
     * @param user The user to process a redemption for
     * @param amount The amount to redeem
     */
    function _processRedemption(address user, uint256 amount) internal {
        uint256 reservePoolBalance = vaultEngine.systemCurrency(address(reservePoolAddress)) -
            vaultEngine.systemDebt(address(reservePoolAddress));

        if (reservePoolBalance < amount) revert insufficientFundsInReservePool(reservePoolBalance);

        if (bondTokens[user] < amount) revert notEnoughBondsToRedeem(amount, bondTokens[user]);

        bondTokens[user] -= amount;
        vaultEngine.moveSystemCurrency(address(reservePoolAddress), user, amount);
    }
}
