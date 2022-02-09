// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../dependencies/Stateful.sol";
import "../dependencies/Eventful.sol";
import "hardhat/console.sol";

interface VaultEngineLike {
    function vaults(bytes32 assetId, address user)
        external
        returns (
            uint256 standby,
            uint256 underlying,
            uint256 collateral,
            uint256 debt,
            uint256 equity
        );

    function assets(bytes32 assetId)
        external
        returns (
            uint256 debtAccumulator,
            uint256 equityAccumulator,
            uint256 adjustedPrice
        );

    function stablecoin(address user) external returns (uint256 balance);

    function removeStablecoin(address user, uint256 amount) external;

    function liquidateDebtPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount
    ) external;

    function liquidateEquityPosition(
        bytes32 assetId,
        address user,
        int256 underlyingAmount,
        int256 equityAmount
    ) external;
}

interface AuctioneerLike {
    function startAuction(
        bytes32 assetId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary
    ) external;
}

interface ReservePoolLike {
    function addAuctionDebt(uint256 newDebt) external;

    function reduceAuctionDebt(uint256 debtToReduce) external;
}

// When a vault is liquidated, the reserve pool will take the on the debt and
// attempt to sell it thru the auction the auction will attempt to sell the collateral to raise
// 'debt + liquidation penalty' the excess collateral will be return to the original vault owner
// surplus from the sales will be sent to the reserve pool,
// and when there are debt, reserve pool will be used to pay off the debt
// if there are no reserve in the pool to pay off the debt, there will be a debt auction
// which will sell IOUs which can be redeemed as the pool is replenished
contract Liquidator is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declaration
    /////////////////////////////////////////
    struct Asset {
        AuctioneerLike auctioneer;
        uint256 debtPenaltyFee;
        uint256 equityPenaltyFee;
    }

    /////////////////////////////////////////
    // State Variables
    /////////////////////////////////////////
    uint256 private constant RAY = 10**27;
    uint256 private constant WAD = 10**18;

    VaultEngineLike public immutable vaultEngine;
    ReservePoolLike public immutable reserve;
    address public immutable treasuryAddress;

    mapping(bytes32 => Asset) public assets;

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////
    constructor(
        address registryAddress,
        VaultEngineLike vaultEngineAddress,
        ReservePoolLike reservePoolAddress,
        address _treasuryAddress
    ) Stateful(registryAddress) {
        vaultEngine = vaultEngineAddress;
        reserve = reservePoolAddress;
        treasuryAddress = _treasuryAddress;
    }

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////
    function initAsset(bytes32 assetId, AuctioneerLike auctioneer) external onlyBy("gov") {
        require(
            address(assets[assetId].auctioneer) == address(0),
            "Liquidator/initAsset: This asset has already been initialized"
        );
        assets[assetId].auctioneer = auctioneer;
        assets[assetId].debtPenaltyFee = 1.17E18;
        assets[assetId].equityPenaltyFee = 1.05E18;
    }

    /**
     * @notice Updates liquidation penalties
     * @param assetId The ID of the collateral type
     * @param debtPenalty The new debt position penalty
     * @param equityPenalty The new equity position penalty
     */
    function updatePenalties(
        bytes32 assetId,
        uint256 debtPenalty,
        uint256 equityPenalty
    ) external onlyBy("gov") {
        emit LogVarUpdate("liquidator", assetId, "debtPenaltyFee", assets[assetId].debtPenaltyFee, debtPenalty);
        emit LogVarUpdate("liquidator", assetId, "equityPenaltyFee", assets[assetId].equityPenaltyFee, equityPenalty);

        assets[assetId].debtPenaltyFee = debtPenalty;
        assets[assetId].equityPenaltyFee = equityPenalty;
    }

    /**
     * @notice Updates the address of the auctioneer contract used by Liquidator
     * @param assetId The ID of the collateral type
     * @param newAuctioneer The address of the new auctioneer
     */
    function updateAuctioneer(bytes32 assetId, AuctioneerLike newAuctioneer) external onlyBy("gov") {
        emit LogVarUpdate(
            "adjustedPriceFeed",
            assetId,
            "auctioneer",
            address(assets[assetId].auctioneer),
            address(newAuctioneer)
        );
        assets[assetId].auctioneer = newAuctioneer;
    }

    /**
     * TODO: #239 How is reduceAuctionDebt used?
     * @param amount The amount to reduce the ReservePool debt by
     */
    function reduceAuctionDebt(uint256 amount) external {
        reserve.reduceAuctionDebt(amount);
    }

    /**
     * @notice Liquidates an undercollateralized vault
     * @param assetId The ID of the collateral type
     * @param user The address of the vault to liquidate
     */
    function liquidateVault(bytes32 assetId, address user) external {
        (uint256 debtAccumulator, , uint256 adjustedPrice) = vaultEngine.assets(assetId);
        (, uint256 underlying, uint256 collateral, uint256 debt, uint256 equity) = vaultEngine.vaults(assetId, user);

        require((underlying + collateral) != 0 && (debt + equity != 0), "Lidquidator: Nothing to liquidate");

        // TODO: Should equity be initialEquity below?
        require(
            collateral * adjustedPrice < debt * debtAccumulator || underlying * adjustedPrice < equity * RAY,
            "Liquidator: Vault collateral/underlying is above the liquidation ratio"
        );

        if (collateral * adjustedPrice < debt * debtAccumulator) {
            // Transfer the debt to reserve pool
            reserve.addAuctionDebt(debt * RAY);
            vaultEngine.liquidateDebtPosition(
                assetId,
                user,
                address(assets[assetId].auctioneer),
                address(reserve),
                -int256(collateral),
                -int256(debt)
            );

            uint256 fundraiseTarget = (debt * debtAccumulator * assets[assetId].debtPenaltyFee) / WAD;
            assets[assetId].auctioneer.startAuction(assetId, collateral, fundraiseTarget, user, address(reserve));
        }

        if (underlying * adjustedPrice < equity * RAY) {
            require(
                vaultEngine.stablecoin(treasuryAddress) >= equity,
                "VaultEngine/liquidateEquityPosition: Not enough treasury funds"
            );

            vaultEngine.liquidateEquityPosition(assetId, user, -int256(underlying), -int256(equity));
            vaultEngine.removeStablecoin(treasuryAddress, equity * RAY);
        }
    }
}
