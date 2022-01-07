// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../dependencies/Stateful.sol";
import "../../dependencies/Eventful.sol";

/**
 * @title VaultEngine contract
 * @author Matthew Rosendin <matt@trustline.co, @mrosendin>
 * @author Shine Lee <shine@trustline.co, @shine2lay>
 * @notice The core accounting module for the Probity system
 */

contract VaultEngineSB is Stateful, Eventful {
    /////////////////////////////////////////
    // Type Declarations
    /////////////////////////////////////////
    struct Vault {
        uint256 freeCollateral; // Collateral that is currently free
        uint256 usedCollateral; // Collateral that is being utilized
        uint256 debt; // Vault's debt balance
        uint256 capital; // Vault's capital balance
        uint256 lastCapitalAccumulator; // Most recent value of the capital rate accumulator
    }

    struct Collateral {
        uint256 debtAccumulator; // Cumulative debt rate
        uint256 capitalAccumulator; // Cumulative capital rate
        uint256 adjustedPrice; // Price adjusted for collateral ratio
        uint256 normDebt; // Normalized debt
        uint256 normCapital; // Normalized capital
        uint256 ceiling; // Max. amount that can be supplied/borrowed
        uint256 floor; // Min. amount of that must be supplied/borrowed
    }

    /////////////////////////////////////////
    // Data Variables
    /////////////////////////////////////////
    uint256 private constant PRECISION_PRICE = 10**27;

    uint256 public totalDebt;
    uint256 public totalCapital;
    uint256 public totalunbackedStablecoin;
    address[] public userList;
    mapping(address => bool) userExists;
    mapping(address => uint256) public stablecoin;
    mapping(address => uint256) public pbt;
    mapping(address => uint256) public unbackedStablecoin;
    mapping(bytes32 => Collateral) public collateralTypes;
    mapping(bytes32 => mapping(address => Vault)) public vaults;

    // For SongBird Purposes only
    uint256 public individualVaultLimit;

    /////////////////////////////////////////
    // Events
    /////////////////////////////////////////

    event CapitalModified(address indexed user, int256 collAmount, int256 capitalAmount);
    event DebtModified(address indexed user, int256 collAmount, int256 debtAmount);

    /////////////////////////////////////////
    // Constructor
    /////////////////////////////////////////

    // solhint-disable-next-line
    constructor(address registryAddress) Stateful(registryAddress) {}

    /////////////////////////////////////////
    // External functions
    /////////////////////////////////////////

    /**
     * @dev return the list of keys for the vaults
     */
    function getUserList() external view returns (address[] memory list) {
        return userList;
    }

    /**
     * @dev returned calculated balance of user's vault position balance
     * @param collId collateral id
     * @param user the vault owner's address
     */
    function vaultBalance(bytes32 collId, address user)
        external
        view
        returns (
            uint256 lockedCollValue,
            uint256 debtPosition,
            uint256 capitalPosition
        )
    {
        Vault storage vault = vaults[collId][user];
        Collateral storage coll = collateralTypes[collId];
        return (
            vault.usedCollateral * coll.adjustedPrice,
            vault.debt * coll.debtAccumulator,
            vault.capital * coll.capitalAccumulator
        );
    }

    /**
     * @dev Modifies a vault's collateral.
     * @param collateral The collateral ID
     * @param user The address of the vault owner
     * @param amount The amount of collateral to modify
     */
    function modifyCollateral(
        bytes32 collateral,
        address user,
        int256 amount
    ) external onlyByProbity {
        vaults[collateral][user].freeCollateral = add(vaults[collateral][user].freeCollateral, amount);
    }

    /**
     * @dev Moves collateral between vaults.
     * @param collateral The collateral ID
     * @param from The address of the originating vault owner
     * @param to The address of the beneficiary vault owner
     * @param amount The amount of collateral to move
     */
    function moveCollateral(
        bytes32 collateral,
        address from,
        address to,
        uint256 amount
    ) external onlyByProbity {
        vaults[collateral][from].freeCollateral -= amount;
        vaults[collateral][to].freeCollateral += amount;
    }

    /**
     * @dev Moves stablecoin between vaults.
     * @param from The address of the originating vault owner
     * @param to The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to move
     */
    function moveStablecoin(
        address from,
        address to,
        uint256 amount
    ) external onlyByProbity {
        stablecoin[from] -= amount;
        stablecoin[to] += amount;
    }

    /**
     * @dev Add stablecoin to user vault.
     * @param user The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to add
     */
    function addStablecoin(address user, uint256 amount) external onlyBy("treasury") {
        stablecoin[user] += amount;
    }

    /**
     * @dev Remove stablecoin from user vault.
     * @param user The address of the beneficiary vault owner
     * @param amount The amount of stablecoin to remove
     */
    function removeStablecoin(address user, uint256 amount) external onlyBy("treasury") {
        stablecoin[user] -= amount;
    }

    /**
     * @dev Reduce a user's PBT balance.
     * @param user The address of the vault to reduce PBT from.
     * @param amount The amount of PBT to reduce.
     */
    function reducePBT(address user, uint256 amount) external onlyBy("treasury") {
        pbt[user] -= amount;
    }

    /**
     * @dev Accrues vault PBT
     * @param collId The ID of the vault collateral type
     */
    function collectInterest(bytes32 collId) public {
        Vault memory vault = vaults[collId][msg.sender];
        Collateral memory collateral = collateralTypes[collId];
        pbt[msg.sender] += vault.capital * (collateral.capitalAccumulator - vault.lastCapitalAccumulator);
        stablecoin[msg.sender] += vault.capital * (collateral.capitalAccumulator - vault.lastCapitalAccumulator);

        vaults[collId][msg.sender].lastCapitalAccumulator = collateral.capitalAccumulator;
    }

    /**
     * @notice Adds capital to the caller's vault
     * @param collId The ID of the collateral type being modified
     * @param treasuryAddress A registered treasury contract address
     * @param collAmount The amount of collateral to add
     * @param capitalAmount The amount of capital to add
     */
    function modifyCapital(
        bytes32 collId,
        address treasuryAddress,
        int256 collAmount,
        int256 capitalAmount
    ) external onlyByWhiteListed {
        require(
            registry.checkValidity("treasury", treasuryAddress),
            "Vault/modifyCapital: Treasury address is not valid"
        );

        if (!userExists[msg.sender]) {
            userList.push(msg.sender);
            userExists[msg.sender] = true;
        }

        collectInterest(collId);
        Vault storage vault = vaults[collId][msg.sender];
        vault.freeCollateral = sub(vault.freeCollateral, collAmount);
        vault.usedCollateral = add(vault.usedCollateral, collAmount);
        int256 normalizedCapital = div(capitalAmount, collateralTypes[collId].capitalAccumulator);
        vault.capital = add(vault.capital, normalizedCapital);

        collateralTypes[collId].normCapital = add(collateralTypes[collId].normCapital, normalizedCapital);

        totalCapital = add(totalCapital, capitalAmount);

        require(totalCapital <= collateralTypes[collId].ceiling, "Vault/modifyCapital: Supply ceiling reached");
        require(
            vault.capital == 0 || (vault.capital * PRECISION_PRICE) > collateralTypes[collId].floor,
            "Vault/modifyCapital: Capital smaller than floor"
        );
        certify(collId, vault);
        checkVaultUnderLimit(collId, vault);

        stablecoin[treasuryAddress] = add(stablecoin[treasuryAddress], capitalAmount);

        emit CapitalModified(msg.sender, collAmount, capitalAmount);
    }

    /**
     * @notice Modifies vault debt
     * @param collId The ID of the vault collateral type
     * @param treasuryAddress The address of the desired treasury contract
     * @param collAmount Amount of collateral supplied as loan security
     * @param debtAmount Amount of stablecoin to borrow
     */
    function modifyDebt(
        bytes32 collId,
        address treasuryAddress,
        int256 collAmount,
        int256 debtAmount
    ) external onlyByWhiteListed {
        require(registry.checkValidity("treasury", treasuryAddress), "Vault/modifyDebt: Treasury address is not valid");

        if (!userExists[msg.sender]) {
            userList.push(msg.sender);
            userExists[msg.sender] = true;
        }

        if (debtAmount > 0) {
            require(
                stablecoin[treasuryAddress] >= uint256(debtAmount),
                "Vault/modifyDebt: Treasury doesn't have enough capital to loan this amount"
            );
        }

        Vault memory vault = vaults[collId][msg.sender];
        vault.freeCollateral = sub(vault.freeCollateral, collAmount);
        vault.usedCollateral = add(vault.usedCollateral, collAmount);
        int256 normalizedDebt = div(debtAmount, collateralTypes[collId].debtAccumulator);
        vault.debt = add(vault.debt, normalizedDebt);

        collateralTypes[collId].normDebt = add(collateralTypes[collId].normDebt, normalizedDebt);

        totalDebt = add(totalDebt, debtAmount);

        require(totalDebt <= collateralTypes[collId].ceiling, "Vault/modifyDebt: Debt ceiling reached");
        require(
            vault.debt == 0 || (vault.debt * PRECISION_PRICE) > collateralTypes[collId].floor,
            "Vault/modifyDebt: Debt Smaller than floor"
        );
        certify(collId, vault);
        checkVaultUnderLimit(collId, vault);

        stablecoin[msg.sender] = add(stablecoin[msg.sender], debtAmount);
        stablecoin[treasuryAddress] = sub(stablecoin[treasuryAddress], debtAmount);

        vaults[collId][msg.sender] = vault;

        emit DebtModified(msg.sender, collAmount, debtAmount);
    }

    /**
     * @notice Liquidates an undercollateralized vault
     * @param collId The ID of the vault collateral type
     * @param user The address of the vault to liquidate
     * @param auctioneer The address of the desired auctioneer contract
     * @param reservePool The address of the desired reserve pool contract
     * @param collateralAmount The amount of collateral to liquidate
     * @param debtAmount The amount of debt to clear
     * @param capitalAmount The amount of capital to clear
     */
    function liquidateVault(
        bytes32 collId,
        address user,
        address auctioneer,
        address reservePool,
        int256 collateralAmount,
        int256 debtAmount,
        int256 capitalAmount
    ) external onlyByProbity {
        Vault storage vault = vaults[collId][user];
        Collateral storage coll = collateralTypes[collId];

        vault.usedCollateral = add(vault.usedCollateral, collateralAmount);
        vault.debt = add(vault.debt, debtAmount);
        vault.capital = add(vault.capital, capitalAmount);
        coll.normDebt = add(coll.normDebt, debtAmount);
        coll.normCapital = add(coll.normCapital, capitalAmount);
        int256 aurToRaise = mul(coll.debtAccumulator, debtAmount) + mul(PRECISION_PRICE, capitalAmount);

        vaults[collId][auctioneer].freeCollateral = sub(vaults[collId][auctioneer].freeCollateral, collateralAmount);
        unbackedStablecoin[reservePool] = sub(unbackedStablecoin[reservePool], aurToRaise);
        totalunbackedStablecoin = sub(totalunbackedStablecoin, aurToRaise);

        emit Log("vault", "liquidateVault", msg.sender);
    }

    /**
     * @notice Used for settlement by the reserve pool
     * @param amount The amount to settle
     */
    function settle(uint256 amount) external onlyByProbity {
        stablecoin[msg.sender] -= amount;
        unbackedStablecoin[msg.sender] -= amount;
        totalDebt -= amount;
        emit Log("vault", "settle", msg.sender);
    }

    function increaseSystemDebt(uint256 amount) external onlyByProbity {
        stablecoin[msg.sender] += amount;
        unbackedStablecoin[msg.sender] += amount;
        totalDebt += amount;
        emit Log("vault", "increaseSystemDebt", msg.sender);
    }

    /// Admin-related functions

    /**
     * @dev Initializes a new collateral type
     * @param collId The collateral type ID
     */
    function initCollType(bytes32 collId) external onlyBy("gov") {
        collateralTypes[collId].debtAccumulator = PRECISION_PRICE;
        collateralTypes[collId].capitalAccumulator = PRECISION_PRICE;
    }

    /**
     * @dev Updates a collateral's debt ceiling
     * @param collId The collateral type ID
     * @param ceiling The new ceiling amount
     */
    function updateCeiling(bytes32 collId, uint256 ceiling) external onlyBy("gov") {
        emit LogVarUpdate("Vault", collId, "ceiling", collateralTypes[collId].ceiling, ceiling);
        collateralTypes[collId].ceiling = ceiling;
    }

    /**
     * @notice Updates a collateral's debt floor
     * @dev Prevent users from creating multiple vaults with very low debt amount and collateral
     * @param collId The collateral type ID
     * @param floor The new floor amount
     */
    function updateFloor(bytes32 collId, uint256 floor) external onlyBy("gov") {
        emit LogVarUpdate("Vault", collId, "floor", collateralTypes[collId].floor, floor);
        collateralTypes[collId].floor = floor;
    }

    /**
     * @notice Updates individual vault limit
     * For Songbird purposes only
     */
    function updateIndividualVaultLimit(uint256 newLimit) external onlyBy("gov") {
        individualVaultLimit = newLimit;
    }

    /**
     * @notice Check if user's vault is under individual vault limit
     * For Songbird purposes only
     */
    function checkVaultUnderLimit(bytes32 collId, Vault memory vault) internal view {
        require(
            (vault.debt * collateralTypes[collId].debtAccumulator) + (vault.capital * PRECISION_PRICE) <=
                individualVaultLimit,
            "Vault is over the individual vault limit"
        );
    }

    /**
     * @dev Updates cumulative indices for the specified collateral type
     * @param collId The collateral type ID
     * @param debtRateIncrease The new rate to increase for debt
     * @param capitalRateIncrease The new rate to increase for capital
     */
    function updateAccumulators(
        bytes32 collId,
        address reservePool,
        uint256 debtRateIncrease,
        uint256 capitalRateIncrease,
        uint256 protocolFeeRates
    ) external onlyBy("teller") {
        emit LogVarUpdate(
            "Vault",
            collId,
            "debtAccumulator",
            collateralTypes[collId].debtAccumulator,
            debtRateIncrease
        );
        emit LogVarUpdate(
            "Vault",
            collId,
            "capitalAccumulator",
            collateralTypes[collId].capitalAccumulator,
            capitalRateIncrease
        );

        Collateral storage coll = collateralTypes[collId];
        uint256 newDebt = coll.normDebt * debtRateIncrease;
        uint256 newCapital = coll.normCapital * capitalRateIncrease;

        totalCapital += newCapital;
        totalDebt += newDebt;

        coll.debtAccumulator += debtRateIncrease;
        coll.capitalAccumulator += capitalRateIncrease;

        uint256 protocolFeeToCollect = coll.normCapital * protocolFeeRates;

        require(
            newCapital + protocolFeeToCollect <= newDebt,
            "VaultEngine/UpdateAccumulator: new capital created is higher than new debt"
        );
        stablecoin[reservePool] += protocolFeeToCollect;
    }

    /**
     * @dev Updates the price of a collateral type
     * @param collId The collateral type ID
     * @param price The new price
     */
    function updateAdjustedPrice(bytes32 collId, uint256 price) external onlyByProbity {
        emit LogVarUpdate("Vault", collId, "price", collateralTypes[collId].adjustedPrice, price);
        collateralTypes[collId].adjustedPrice = price;
    }

    /////////////////////////////////////////
    // Internal Functions
    /////////////////////////////////////////

    /**
     * @dev Certifies that the vault meets the collateral requirement
     * @param collId The collateral type ID
     * @param vault The vault to certify
     */
    function certify(bytes32 collId, Vault memory vault) internal view {
        require(
            (vault.debt * collateralTypes[collId].debtAccumulator) + (vault.capital * PRECISION_PRICE) <=
                vault.usedCollateral * collateralTypes[collId].adjustedPrice,
            "Vault/certify: Not enough collateral"
        );
    }

    function sub(uint256 a, int256 b) internal pure returns (uint256 c) {
        unchecked {
            c = a - uint256(b);
        }
        require(b <= 0 || c <= a, "Vault/sub: sub op failed");
        require(b >= 0 || c >= a, "Vault/sub: sub op failed");
    }

    function add(uint256 a, int256 b) internal pure returns (uint256 c) {
        unchecked {
            c = a + uint256(b);
        }
        require(b >= 0 || c <= a, "Vault/add: add op failed");
        require(b <= 0 || c >= a, "Vault/add: add op failed");
    }

    function mul(uint256 a, int256 b) internal pure returns (int256 c) {
        c = int256(a) * b;
        require(int256(a) >= 0, "Vault/mul: mul op failed");
        require(b == 0 || c / b == int256(a), "Vault/mul: mul op failed");
    }
}
