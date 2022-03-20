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
  VaultEngineNoWhitelist,
  VaultEngineWithLimit,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY, ASSET_ID } from "../../utils/constants";
import { BigNumber } from "ethers";
import assertRevert from "../../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let coll: SignerWithAddress;
let assetManager: SignerWithAddress;

// Contracts
let vaultEngine: VaultEngineNoWhitelist;
let registry: Registry;
let reservePool: ReservePool;
let nativeAssetManager: NativeAssetManager;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

let flrAssetId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Coston Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.vaultEngineCoston;
    reservePool = contracts.reservePool;
    nativeAssetManager = contracts.nativeAssetManager;
    teller = contracts.teller;
    priceFeed = contracts.priceFeed;
    ftso = contracts.ftso;
    treasury = contracts.treasury;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    coll = signers.don;
    assetManager = signers.lender;

    await registry.setupAddress(bytes32("gov"), gov.address);
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
      await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID["FLR"], RAY.mul(1));
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(ASSET_ID["FLR"], owner.address, STANDBY_AMOUNT);
    });

    it("tests that non whitelisted user can call modifyEquity", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address);

      await vaultEngine.modifyEquity(
        ASSET_ID["FLR"],
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });
  });

  describe("modifyEquity Unit Tests", function () {
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
      await vaultEngine.connect(gov).initAsset(ASSET_ID["FLR"]);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID["FLR"], RAD.mul(10_000_000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), assetManager.address);
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID["FLR"], RAY.mul(1));
      await vaultEngine
        .connect(assetManager)
        .modifyStandbyAsset(
          ASSET_ID["FLR"],
          owner.address,
          STANDBY_AMOUNT.mul(2)
        );

      await vaultEngine.modifyEquity(
        ASSET_ID["FLR"],
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("tests that non whitelisted user can call modifyDebt", async () => {
      await registry
        .connect(gov)
        .setupAddress(bytes32("notWhitelisted"), owner.address);

      await vaultEngine.modifyDebt(
        ASSET_ID["FLR"],
        treasury.address,
        COLL_AMOUNT,
        DEBT_AMOUNT
      );
    });
  });
});
