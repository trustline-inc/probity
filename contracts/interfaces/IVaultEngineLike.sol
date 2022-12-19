// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.4;

interface IVaultEngineLike {
    enum Category {
        UNSUPPORTED,
        UNDERLYING,
        COLLATERAL,
        BOTH
    }

    function addSystemCurrency(address user, uint256 amount) external;

    function removeSystemCurrency(address user, uint256 amount) external;

    function reducePbt(address user, uint256 amount) external;

    function updateAdjustedPrice(bytes32 assetId, uint256 price) external;

    function systemCurrency(address user) external returns (uint256);

    function systemDebt(address user) external returns (uint256);

    function settle(uint256 amount) external;

    function increaseSystemDebt(uint256 amount) external;

    function debtAccumulator() external returns (uint256);

    function equityAccumulator() external returns (uint256);

    function lendingPoolDebt() external returns (uint256);

    function lendingPoolEquity() external returns (uint256);

    function lendingPoolPrincipal() external returns (uint256);

    function lendingPoolSupply() external returns (uint256);

    function moveSystemCurrency(
        address from,
        address to,
        uint256 amount
    ) external;

    function modifyStandbyAmount(
        bytes32 collateral,
        address user,
        int256 amount
    ) external;

    function vaults(bytes32 assetId, address user)
        external
        returns (
            uint256 standbyAmount,
            uint256 underlying,
            uint256 collateral,
            uint256 normDebt,
            uint256 normEquity,
            uint256 initialEquity,
            uint256 debtPrincipal
        );

    function updateAccumulators(
        address reservePool,
        uint256 debtRateIncrease,
        uint256 equityRateIncrease,
        uint256 protocolFeeRates
    ) external;

    function moveAsset(
        bytes32 collateral,
        address from,
        address to,
        uint256 amount
    ) external;

    function liquidateDebtPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount,
        int256 principalAmount
    ) external;

    function liquidateEquityPosition(
        bytes32 assetId,
        address user,
        address auctioneer,
        int256 assetToAuction,
        int256 assetToReturn,
        int256 equityAmount,
        int256 initialEquityAmount
    ) external;

    function assets(bytes32 assetId)
        external
        returns (
            uint256 adjustedPrice,
            uint256 normDebt,
            uint256 normEquity,
            uint256 ceiling,
            uint256 floor,
            Category category
        );
}
