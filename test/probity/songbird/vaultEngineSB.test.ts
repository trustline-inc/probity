import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  MockFtso,
  NativeToken,
  PriceFeed,
  Registry,
  ReservePool,
  Teller,
  Treasury,
  VaultEngineSB,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAD, WAD, RAY } from "../../utils/constants";
import { BigNumber } from "ethers";
import assertRevert from "../../utils/assertRevert";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let gov: SignerWithAddress;
let coll: SignerWithAddress;

// Contracts
let vaultEngine: VaultEngineSB;
let registry: Registry;
let reservePool: ReservePool;
let nativeToken: NativeToken;
let ftso: MockFtso;
let teller: Teller;
let priceFeed: PriceFeed;
let treasury: Treasury;

let flrAssetId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Vault Engine Songbird Unit Tests", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.vaultEngineSB;
    reservePool = contracts.reservePool;
    nativeToken = contracts.nativeToken;
    teller = contracts.teller;
    priceFeed = contracts.priceFeed;
    ftso = contracts.ftso;
    treasury = contracts.treasury;

    owner = signers.owner;
    user = signers.alice;
    gov = signers.charlie;
    coll = signers.don;

    await registry.setupAddress(bytes32("gov"), gov.address);
    await registry.setupAddress(bytes32("whitelisted"), user.address);
    await registry.setupAddress(bytes32("whitelisted"), owner.address);
  });

  describe("individualVaultLimit Unit Tests", function () {
    beforeEach(async function () {
      await owner.sendTransaction({
        to: user.address,
        value: ethers.utils.parseEther("1"),
      });
      await vaultEngine.connect(gov).initAssetType(flrAssetId);
      await vaultEngine
        .connect(gov)
        .updateCeiling(flrAssetId, RAD.mul(10000000));
      await registry
        .connect(gov)
        .setupAddress(bytes32("assetManager"), coll.address);
    });

    it("updateIndividualVaultLimit works properly", async () => {
      const NEW_INDIVIDUAL_VAULT_LIMTI = RAD.mul(500);
      expect(await vaultEngine.connect(gov).individualVaultLimit()).to.equal(0);
      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);
      expect(await vaultEngine.connect(gov).individualVaultLimit()).to.equal(
        NEW_INDIVIDUAL_VAULT_LIMTI
      );
    });

    it("modifyDebt uses individualVaultLimit", async () => {
      const UNDERLYING_AMOUNT = WAD.mul(10000);
      const COLL_AMOUNT = WAD.mul(10000);
      const EQUITY_AMOUNT = WAD.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMTI = RAD.mul(500);

      await vaultEngine
        .connect(coll)
        .modifyStandbyAsset(
          flrAssetId,
          owner.address,
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await assertRevert(
        vaultEngine.modifyEquity(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          EQUITY_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMTI);

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        EQUITY_AMOUNT
      );
    });

    it("modifyEquity uses individualVaultLimit", async () => {
      const UNDERLYING_AMOUNT = WAD.mul(10000);
      const COLL_AMOUNT = WAD.mul(10000);
      const DEBT_AMOUNT = WAD.mul(500);
      const NEW_INDIVIDUAL_VAULT_LIMIT = RAD.mul(1000);

      await vaultEngine
        .connect(coll)
        .modifyStandbyAsset(
          flrAssetId,
          owner.address,
          COLL_AMOUNT.add(UNDERLYING_AMOUNT)
        );
      await vaultEngine
        .connect(gov)
        .updateAdjustedPrice(flrAssetId, RAY.mul(1));

      await vaultEngine.connect(gov).updateIndividualVaultLimit(RAD.mul(500));

      await vaultEngine.modifyEquity(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        DEBT_AMOUNT
      );

      await assertRevert(
        vaultEngine.modifyDebt(
          flrAssetId,
          treasury.address,
          UNDERLYING_AMOUNT,
          DEBT_AMOUNT
        ),
        "Vault is over the individual vault limit"
      );

      await vaultEngine
        .connect(gov)
        .updateIndividualVaultLimit(NEW_INDIVIDUAL_VAULT_LIMIT);

      await vaultEngine.modifyDebt(
        flrAssetId,
        treasury.address,
        UNDERLYING_AMOUNT,
        DEBT_AMOUNT
      );
    });
  });
});
