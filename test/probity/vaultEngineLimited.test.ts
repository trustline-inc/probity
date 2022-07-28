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
  VaultEngineLimited,
} from "../../typechain";

import { deployTest } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY, ASSET_ID } from "../utils/constants";
import assertRevert from "../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let coll: SignerWithAddress;

// Contracts
let vaultEngine: any;
let registry: Registry;
let reservePool: ReservePool;
let nativeAssetManager: NativeAssetManager;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Limited Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest("limited");
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
    gov = signers.charlie!;
    coll = signers.don!;

    await registry.setupAddress(bytes32("gov"), gov.address, true);
    await registry.setupAddress(bytes32("whitelisted"), user.address, false);
    await registry.setupAddress(bytes32("whitelisted"), owner.address, false);
    await vaultEngine.updateTreasuryAddress(contracts.treasury.address);
  });

  describe("vaultLimit Unit Tests", function () {
    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAsset(ASSET_ID.FLR, 2);
      await vaultEngine
        .connect(gov)
        .updateCeiling(ASSET_ID.FLR, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), coll.address, true);
    });

    it("updateIndividualVaultLimit works properly", async () => {
      const NEW_INDIVIDUAL_VAULT_LIMTI = RAD.mul(500);
      expect(await vaultEngine.connect(gov).vaultLimit()).to.equal(0);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);
      expect(await vaultEngine.connect(gov).vaultLimit()).to.equal(
        NEW_INDIVIDUAL_VAULT_LIMTI
      );
    });

    it("modifyDebt uses vaultLimit", async () => {
      const UNDERLYING_AMOUNT = WAD.mul(10000);
      const COLL_AMOUNT = WAD.mul(10000);
      const EQUITY_AMOUNT = WAD.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMTI = RAD.mul(500);

      await vaultEngine
        .connect(coll)
        .modifyStandbyAmount(
          ASSET_ID.FLR,
          owner.address,
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));

      await assertRevert(
        vaultEngine.modifyEquity(
          ASSET_ID.FLR,

          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,

        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("modifyEquity uses vaultLimit", async () => {
      const UNDERLYING_AMOUNT = WAD.mul(10000);
      const COLL_AMOUNT = WAD.mul(10000);
      const DEBT_AMOUNT = WAD.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMIT = RAD.mul(1000);

      await vaultEngine
        .connect(coll)
        .modifyStandbyAmount(
          ASSET_ID.FLR,
          owner.address,
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(ASSET_ID.FLR, RAY.mul(1));

      await vaultEngine.connect(gov).updateIndividualVaultLimit(RAD.mul(500));

      await vaultEngine.modifyEquity(
        ASSET_ID.FLR,

        UNDERLYING_AMOUNT,
        DEBT_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyDebt(
          ASSET_ID.FLR,

          UNDERLYING_AMOUNT,
          DEBT_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMIT);

      await vaultEngine.modifyDebt(
        ASSET_ID.FLR,

        UNDERLYING_AMOUNT,
        DEBT_AMOUNT
      );
    });
  });
});
