// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";

interface VaultEngineLike {
    function debtAccumulator() external returns (uint256);

    function equityAccumulator() external returns (uint256);

    function lendingPoolDebt() external returns (uint256);

    function lendingPoolEquity() external returns (uint256);

    function lendingPoolPrincipal() external returns (uint256);

    function lendingPoolSupply() external returns (uint256);

    function updateAccumulators(
        address reservePool,
        uint256 debtRateIncrease,
        uint256 equityRateIncrease,
        uint256 protocolFeeRates
    ) external;
}

interface IAPR {
    // solhint-disable-next-line
    function APR_TO_MPR(uint256 APR) external returns (uint256);
}

/**
 * @title Teller contract
 * @notice Calculates and update the rates for probity
 */
contract Teller is Stateful, Eventful {
    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant WAD = 10**18;
    uint256 private constant RAY = 10**27;
    // Set max APR to 100%
    uint256 public constant MAX_APR = WAD * 2 * 1e9;

    VaultEngineLike public immutable vaultEngine;
    IAPR public immutable lowAprRate;
    IAPR public immutable highAprRate;

    address public reservePool; // reservePool address will be the recipient of the protocol fees calculated
    uint256 public apr; // Annualized percentage rate
    uint256 public mpr; // Momentized percentage rate
    uint256 public lastUpdated; // Unix timestamp of last update
    uint256 public protocolFee; // protocol fee in % that system will take when accumulators are updated

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event RatesUpdated(uint256 timestamp, uint256 debtAccumulatorIncrease, uint256 equityAccumulatorIncrease);

    /////////////////////////////////////////
    // Errors
    /////////////////////////////////////////

    error lendingPoolSupplyCanNotBeZero();

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        address reservePoolAddress,
        IAPR lowAprAddress,
        IAPR highAprAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        lowAprRate = lowAprAddress;
        highAprRate = highAprAddress;
        reservePool = reservePoolAddress;
        apr = RAY;
        mpr = RAY;
        lastUpdated = block.timestamp;
        protocolFee = 0;
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    function setProtocolFee(uint256 newProtocolFee) external onlyBy("gov") {
        emit LogVarUpdate(bytes32("teller"), bytes32("protocolFee"), protocolFee, newProtocolFee);
        protocolFee = newProtocolFee;
    }

    /**
     * @dev update the reservePool address
     * @param newReservePool the new reserve Pool's address
     */
    function setReservePoolAddress(address newReservePool) public onlyBy("gov") {
        emit LogVarUpdate(bytes32("teller"), bytes32("reservePool"), reservePool, newReservePool);
        reservePool = newReservePool;
    }

    /**
     * @dev Updates the debt and equity rate accumulators
     */
    function updateAccumulators() external onlyWhen("paused", false) {
        uint256 debtAccumulator = vaultEngine.debtAccumulator();
        uint256 lendingPoolDebt = vaultEngine.lendingPoolDebt();
        uint256 lendingPoolEquity = vaultEngine.lendingPoolEquity();

        // Actual totals
        uint256 lendingPoolPrincipal = vaultEngine.lendingPoolPrincipal();
        uint256 lendingPoolSupply = vaultEngine.lendingPoolSupply();

        if (lendingPoolSupply == 0) revert lendingPoolSupplyCanNotBeZero();

        uint256 utilization = Math._wdiv(lendingPoolPrincipal, lendingPoolSupply);

        // Set new APR (round to nearest 0.25%)
        if (utilization >= 1e18) {
            apr = MAX_APR;
        } else {
            uint256 oneMinusUtilization = RAY - (utilization * 1e9);
            uint256 oneDividedByOneMinusUtilization = Math._rdiv(10**27 * 0.01, oneMinusUtilization);

            uint256 round = 0.0025 * 10**27;
            apr = oneDividedByOneMinusUtilization + RAY;
            apr = ((apr + round - 1) / round) * round;

            if (apr > MAX_APR) {
                apr = MAX_APR;
            }
        }
        // Set new MPR
        if (apr > 1500000000000000000000000000) {
            mpr = highAprRate.APR_TO_MPR(apr);
        } else {
            mpr = lowAprRate.APR_TO_MPR(apr);
        }

        // Update debt accumulator
        uint256 debtRateIncrease = Math._rmul(Math._rpow(mpr, (block.timestamp - lastUpdated)), debtAccumulator) -
            debtAccumulator;

        uint256 debtCreated = debtRateIncrease * lendingPoolDebt;
        uint256 equityAccumulatorDiff = debtCreated / lendingPoolEquity;

        uint256 protocolFeeRate = 0;
        if (protocolFee != 0) {
            protocolFeeRate = (equityAccumulatorDiff * protocolFee) / WAD;
        }

        uint256 equityRateIncrease = equityAccumulatorDiff - protocolFeeRate;

        // Update values
        lastUpdated = block.timestamp;
        vaultEngine.updateAccumulators(reservePool, debtRateIncrease, equityRateIncrease, protocolFeeRate);

        emit RatesUpdated(lastUpdated, debtRateIncrease, equityRateIncrease);
    }
}
