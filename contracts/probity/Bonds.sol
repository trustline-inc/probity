pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";

interface VaultEngineLike {
    function stablecoin(address user) external returns (uint256 balance);

    function unbackedDebt(address user) external returns (uint256 balance);

    function settle(uint256 balance) external;

    function increaseSystemDebt(uint256 amount) external;

    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external;
}

contract Bonds is Stateful, Eventful {
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

    // Every Y hours, vouchers received per stablecoin goes up by X%
    // TODO: evaluate these values
    uint256 public salePriceIncreasePerStep = 5E16;
    uint256 public saleStepPeriod = 6 hours;
    // Max vouchers received per stablecoin is 50%
    // TODO: evaluate this max value
    uint256 public saleMaxPrice = 1.5E18;
    mapping(address => uint256) public vouchers;
    uint256 public totalVouchers;

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
     * @notice Returns the amount of vouchers received per stablecoin
     * @dev Stepwise price increases until max price is met
     */
    function vouchersPerStablecoin() public view returns (uint256 price) {
        uint256 steps = (block.timestamp - offering.startTime) / saleStepPeriod;

        if (ONE + (salePriceIncreasePerStep * steps) > saleMaxPrice) {
            return saleMaxPrice;
        } else {
            return ONE + (salePriceIncreasePerStep * steps);
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
        require(reservePoolAddress == address(0), "Bonds/setReservePoolAddress: reservePool Address already set");
        reservePoolAddress = _reservePoolAddress;
    }

    /**
     * @notice Updates the maximum price for a sale
     * @param newMaxPrice The maximum price to set
     */
    function updateSaleMaxPrice(uint256 newMaxPrice) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "saleMaxPrice", saleMaxPrice, newMaxPrice);
        saleMaxPrice = newMaxPrice;
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
     * @notice Updates the sale price increase per step
     * @param newPriceIncreasePerStep The new price increase per step
     */
    function updateSalePriceIncreasePerStep(uint256 newPriceIncreasePerStep) external onlyBy("gov") {
        emit LogVarUpdate("reserve", "salePriceIncreasePerStep", salePriceIncreasePerStep, newPriceIncreasePerStep);
        salePriceIncreasePerStep = newPriceIncreasePerStep;
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
     * @notice Processes a redemption when the system is shut down
     * @param user The user to process for
     * @param amount The amount to redeem
     */
    function shutdownRedemption(address user, uint256 amount) external onlyWhen("shutdown", true) onlyBy("shutdown") {
        processRedemption(user, amount);
    }

    /**
     * @notice Purchases vouchers of an offering
     * @param amount The amount to be purchased
     */
    function purchaseVouchers(uint256 amount) external {
        require(offering.active, "ReservePool/purchaseVouchers: vouchers are not currently on sale");
        require(
            offering.amount >= amount,
            "ReservePool/purchaseVouchers: Can't purchase more vouchers than amount available"
        );

        vaultEngine.moveStablecoin(msg.sender, reservePoolAddress, amount);
        uint256 amountToBuy = ((amount * vouchersPerStablecoin()) / ONE);
        vouchers[msg.sender] += amountToBuy;
        totalVouchers += amountToBuy;
        offering.amount = offering.amount - amount;
        if (offering.amount == 0) {
            offering.active = false;
        }
    }

    /**
     * @notice Redeems vouchers for assets
     * @param amount The amount to redeem
     */
    function redeemVouchers(uint256 amount) external {
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
            vaultEngine.stablecoin(address(reservePoolAddress)) >= amount,
            "ReservePool/processRedemption: The reserve pool doesn't have enough funds"
        );
        require(
            vouchers[user] >= amount,
            "ReservePool/processRedemption: User doesn't have enough vouchers to redeem this amount"
        );

        vouchers[user] -= amount;
        vaultEngine.moveStablecoin(address(reservePoolAddress), user, amount);
    }
}
