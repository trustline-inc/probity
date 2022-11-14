import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  MockFtso,
  NativeAssetManager,
  PriceFeed,
  Registry,
  ReservePool,
  Teller,
  Treasury,
  VaultEngineRestricted,
} from "../../typechain";

import { deployTest } from "../../lib/deployer";
import { ethers } from "hardhat";
import { bytes32, RAD, WAD, RAY, ASSET_ID } from "../utils/constants";
import assertRevert from "../utils/assertRevert";

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let admin: SignerWithAddress;
let coll: SignerWithAddress;
let assetManager: SignerWithAddress;

// Contracts
let vaultEngine: VaultEngineRestricted;
let registry: Registry;
let reservePool: ReservePool;
let nativeAssetManager: NativeAssetManager;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Unrestricted Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest("restricted");
    // Set contracts
    registry = contracts.registry!;
    vaultEngine = contracts.vaultEngine!;
    reservePool = contracts.reservePool!;
    nativeAssetManager = contracts.nativeAssetManager!;
    teller = contracts.teller!;
    priceFeed = contracts.priceFeed!;
    ftso = contracts.ftso!;
    treasury = contracts.treasury!;

    owner = signers.owner!;
    user = signers.alice!;
    admin = signers.charlie!;
    coll = signers.don!;
    assetManager = signers.lender!;

    await registry.register(bytes32("admin"), admin.address, true);
    await vaultEngine.updateTreasuryAddress(contracts.treasury!.address);
  });

  describe("modifyEquity Unit Tests", function () {
    const STANDBY_AMOUNT = WAD.mul(10_000);
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(admin).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(admin)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(admin)
        .register(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(admin)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAmount(ASSET_ID.FLR, owner.address, STANDBY_AMOUNT);
    });

    it("only allows whitelisted users to call modifyEquity", async () => {
      await registry
        .connect(admin)
        .register(bytes32("notWhitelisted"), owner.address, false);

      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,

          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "callerDoesNotHaveRequiredRole"
      );

      await registry
        .connect(admin)
        .register(bytes32("whitelisted"), owner.address, false);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,

        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });
  });

  describe("modifyDebt Unit Tests", function () {
    const STANDBY_AMOUNT = WAD.mul(10_000);
    const UNDERLYING_AMOUNT = WAD.mul(10_000);
    const EQUITY_AMOUNT = WAD.mul(2000);
    const COLL_AMOUNT = WAD.mul(4000);
    const DEBT_AMOUNT = WAD.mul(2000);

    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(admin).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(admin)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
      await registry
        .connect(admin)
        .register(bytes32("assetManager"), assetManager.address, true);
      await vaultEngine
        .connect(admin)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAmount(
          ASSET_ID.FLR,
          owner.address,
          STANDBY_AMOUNT.mul(2)
        );

      await registry
        .connect(admin)
        .register(bytes32("whitelisted"), owner.address, false);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("only allows whitelisted users to call modifyDebt", async () => {
      await registry
        .connect(admin)
        .register(bytes32("notWhitelisted"), owner.address, false);
      await assertRevert(
        vaultEngine.modifyDebt(ASSET_ID.FLR, COLL_AMOUNT, DEBT_AMOUNT),
        "callerDoesNotHaveRequiredRole"
      );

      await registry
        .connect(admin)
        .register(bytes32("whitelisted"), owner.address, false);

      await vaultEngine.modifyDebt(ASSET_ID.FLR, COLL_AMOUNT, DEBT_AMOUNT);
    });
  });
});
