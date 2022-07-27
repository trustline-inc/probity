// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "../dependencies/Math.sol";
import "hardhat/console.sol";

interface VaultEngineLike {
    function debtAccumulator() external view returns (uint256);

    function equityAccumulator() external view returns (uint256);

    function totalNormDebt() external view returns (uint256);

    function assets(bytes32)
        external
        returns (
            uint256 adjustedPrice,
            uint256 normDebt,
            uint256 normEquity
        );

    function lendingPoolDebt() external returns (uint256);

    function lendingPoolEquity() external returns (uint256);

    function updateAccumulators(
        bytes32 assetId,
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
    // Type Declarations
    /////////////////////////////////////////
    struct Asset {
        uint256 lastUpdated;
        uint256 protocolFee;
    }

    struct CreditFacility {
        uint256 utilization;
        uint256 protocolFeeRate;
        uint256 debtRateIncrease;
        uint256 equityRateIncrease;
    }

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
    mapping(bytes32 => Asset) public assets; // assetId -> Asset

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////
    event AssetInitialized(bytes32 indexed assetId, uint256 protocolFee);
    event RatesUpdated(uint256 timestamp, uint256 debtAccumulator, uint256 equityAccumulator);

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
    }

    /////////////////////////////////////////
    // External Functions
    /////////////////////////////////////////

    /**
     * @dev initialized a new asset
     * @param assetId the asset ID
     * @param protocolFee the protocolFee to take during accumulator calcuation
     */
    function initAsset(bytes32 assetId, uint256 protocolFee) external onlyBy("gov") {
        require(assets[assetId].lastUpdated == 0, "Teller/initAsset: This asset has already been initialized");
        assets[assetId].lastUpdated = block.timestamp;
        assets[assetId].protocolFee = protocolFee;

        emit AssetInitialized(assetId, protocolFee);
    }

    /**
     * @dev update the protocol fee for an asset
     * @param assetId to update
     * @param protocolFee new protocolFee
     */
    function setProtocolFee(bytes32 assetId, uint256 protocolFee) external onlyBy("gov") {
        emit LogVarUpdate(bytes32("teller"), assetId, bytes32("protocolFee"), assets[assetId].protocolFee, protocolFee);
        assets[assetId].protocolFee = protocolFee;
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
     * @param assetId of the asset to update accumulators
     */
    function updateAccumulators(bytes32 assetId) external {
        console.log("====================== Update accumulators =======================");
        require(assets[assetId].lastUpdated != 0, "Teller/updateAccumulators: Asset not initialized");

        Asset memory asset = assets[assetId];
        CreditFacility memory creditFacility;
        uint256 debtAccumulator = vaultEngine.debtAccumulator();
        uint256 equityAccumulator = vaultEngine.equityAccumulator();
        uint256 totalNormDebt = vaultEngine.totalNormDebt();

        uint256 lendingPoolDebt = vaultEngine.lendingPoolDebt();
        uint256 lendingPoolEquity = vaultEngine.lendingPoolEquity();

        require(lendingPoolEquity > 0, "Teller/updateAccumulators: Total equity cannot be zero");

        creditFacility.utilization = Math._wdiv(lendingPoolDebt, lendingPoolEquity);

        // Update debt accumulator
        uint256 rate = Math._rpow(mpr, (block.timestamp - asset.lastUpdated));
        creditFacility.debtRateIncrease = Math._rmul(rate, debtAccumulator) - debtAccumulator;
        console.log("debtRateIncrease:", creditFacility.debtRateIncrease);
        console.log("debtAccumulator:", creditFacility.debtRateIncrease + debtAccumulator);
        console.log("totalNormDebt:", totalNormDebt);
        console.log("newDebt:", Math._rmul(creditFacility.debtRateIncrease + debtAccumulator, totalNormDebt));

        // Update protocol fee rate
        // creditFacility.protocolFeeRate = 0;
        // if (assets[assetId].protocolFee != 0) {
        //     creditFacility.protocolFeeRate = (equityAccumulatorDiff * assets[assetId].protocolFee) / WAD;
        // }
        // console.log("creditFacility.protocolFeeRate:", creditFacility.protocolFeeRate);

        // Update equity accumulator
        creditFacility.equityRateIncrease =
            Math._rmul(creditFacility.debtRateIncrease + debtAccumulator, totalNormDebt) -
            Math._rmul(debtAccumulator, totalNormDebt);
        console.log("equityRateIncrease:", creditFacility.equityRateIncrease);
        console.log("equityAccumulator:", creditFacility.equityRateIncrease + equityAccumulator);

        // Set new APR (round to nearest 0.25%)
        if (creditFacility.utilization >= 1e18) {
            apr = MAX_APR;
        } else {
            uint256 oneMinusUtilization = RAY - (creditFacility.utilization * 1e9);
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

        console.log("mpr:", mpr);

        // Update values
        asset.lastUpdated = block.timestamp;
        vaultEngine.updateAccumulators(
            assetId,
            reservePool,
            creditFacility.debtRateIncrease,
            creditFacility.equityRateIncrease,
            creditFacility.protocolFeeRate
        );
        console.log("====================== end =======================");
    }
}
