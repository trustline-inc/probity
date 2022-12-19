pragma solidity 0.8.4;

import "./IVPAssetManangerLike.sol";

interface IAuctioneerLike {
    function startAuction(
        bytes32 assetId,
        uint256 lotSize,
        uint256 debtSize,
        address owner,
        address beneficiary,
        IVPAssetManagerLike vpAssetManagerAddress,
        bool sellAllLot
    ) external;
}
