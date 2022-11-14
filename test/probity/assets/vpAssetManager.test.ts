import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  VaultEngine,
  Registry,
  MockVPToken,
  VPAssetManager,
  MockFtsoManager,
  MockFtsoRewardManager,
} from "../../../typechain";

import { deployTest } from "../../../lib/deployer";
import parseEvents from "../../utils/parseEvents";
import { ethers } from "hardhat";
import * as chai from "chai";
import { bytes32, RAY, WAD } from "../../utils/constants";
import assertRevert from "../../utils/assertRevert";
import { rdiv } from "../../utils/math";

const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;
let admin: SignerWithAddress;
let auctioneerCaller: SignerWithAddress;

// Contracts
let vpAssetManager: VPAssetManager;
let mockVpToken: MockVPToken;
let vaultEngine: VaultEngine;
let mockFtsoManager: MockFtsoManager;
let mockFtsoRewardManager: MockFtsoRewardManager;
let registry: Registry;

const AMOUNT_TO_WITHDRAW = WAD.mul(50);

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("VP AssetManager  Unit Test", function () {
  const AMOUNT_TO_MINT = WAD.mul(100000);
  beforeEach(async function () {
    const { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine!;
    registry = contracts.registry!;
    vpAssetManager = contracts.vpAssetManager!;
    mockFtsoManager = contracts.ftsoManager!;
    mockFtsoRewardManager = contracts.ftsoRewardManager!;
    mockVpToken = contracts.mockVpToken!;

    owner = signers.owner!;
    user = signers.alice!;
    admin = signers.bob!;
    auctioneerCaller = signers.charlie!;

    await registry.register(bytes32("admin"), admin.address, true);
    await registry
      .connect(admin)
      .register(bytes32("whitelisted"), owner.address, false);
    await registry
      .connect(admin)
      .register(bytes32("whitelisted"), user.address, false);

    await registry
      .connect(admin)
      .register(bytes32("auctioneer"), auctioneerCaller.address, false);

    await mockVpToken.mint(owner.address, AMOUNT_TO_MINT);

    await mockVpToken.approve(vpAssetManager.address, AMOUNT_TO_MINT);
  });

  describe("claimReward  Unit Test", function () {
    const CLAIMABLE_START_EPOCH = 1;
    const CLAIMABLE_END_EPOCH = 2;
    const CURRENT_REWARD_EPOCH = 1;
    const REWARD_AMOUNT = WAD;
    beforeEach(async function () {
      await mockVpToken.mint(user.address, AMOUNT_TO_MINT);
      await mockVpToken
        .connect(user)
        .approve(vpAssetManager.address, AMOUNT_TO_MINT);

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH);
      await mockFtsoRewardManager.setStartAndEpochId(
        CLAIMABLE_START_EPOCH,
        CLAIMABLE_END_EPOCH
      );
      await mockFtsoRewardManager.setRewardAmount(REWARD_AMOUNT);

      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(100));

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH + 1);
      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(50));
      await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT.div(70));

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH + 2);
      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(60));
      await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT.div(90));
    });

    it("test that if epochToEnd is provided, reward will be claimed only up to epochToEnd", async () => {
      const EPOCH_TO_END = 1;

      const rewardPerUnitForEpochOneBefore =
        await vpAssetManager.rewardPerUnitForEpoch(1);
      expect(rewardPerUnitForEpochOneBefore).to.equal(0);
      const rewardPerUnitForEpochTwoBefore =
        await vpAssetManager.rewardPerUnitForEpoch(2);
      expect(rewardPerUnitForEpochTwoBefore).to.equal(0);

      const lastClaimedEpochBefore = await vpAssetManager.lastClaimedEpoch();
      expect(lastClaimedEpochBefore).to.equal(0);

      await vpAssetManager.claimReward(EPOCH_TO_END);

      const rewardPerUnitForEpochOneAfter =
        await vpAssetManager.rewardPerUnitForEpoch(1);
      expect(rewardPerUnitForEpochOneAfter).to.not.equal(0);
      const rewardPerUnitForEpochTwoAfter =
        await vpAssetManager.rewardPerUnitForEpoch(2);
      expect(rewardPerUnitForEpochTwoAfter).to.equal(0);

      const lastClaimedEpochAfter = await vpAssetManager.lastClaimedEpoch();
      expect(lastClaimedEpochAfter).to.equal(1);
    });

    it("test that if epochToEnd is not provided, all available reward will be claimed", async () => {
      const EXPECTED_REWARD_PER_UNIT_EPOCH_ONE = rdiv(
        REWARD_AMOUNT,
        AMOUNT_TO_MINT.div(100)
      );
      const EXPECTED_REWARD_PER_UNIT_EPOCH_TWO = rdiv(
        REWARD_AMOUNT,
        AMOUNT_TO_MINT.div(100)
          .add(AMOUNT_TO_MINT.div(50))
          .add(AMOUNT_TO_MINT.div(70))
      );

      await vpAssetManager.claimReward(0);

      const rewardPerUnitForEpochOneAfter =
        await vpAssetManager.rewardPerUnitForEpoch(1);
      expect(rewardPerUnitForEpochOneAfter).to.equal(
        EXPECTED_REWARD_PER_UNIT_EPOCH_ONE
      );
      const rewardPerUnitForEpochTwoAfter =
        await vpAssetManager.rewardPerUnitForEpoch(2);
      expect(rewardPerUnitForEpochTwoAfter).to.equal(
        EXPECTED_REWARD_PER_UNIT_EPOCH_TWO
      );
      const lastClaimedEpochAfter = await vpAssetManager.lastClaimedEpoch();
      expect(lastClaimedEpochAfter).to.equal(2);
    });
  });

  describe("userCollectReward  Unit Test", function () {
    const CLAIMABLE_START_EPOCH = 1;
    const CLAIMABLE_END_EPOCH = 2;
    const CURRENT_REWARD_EPOCH = 1;
    const REWARD_AMOUNT = WAD;

    beforeEach(async function () {
      await mockVpToken.mint(user.address, AMOUNT_TO_MINT);
      await mockVpToken
        .connect(user)
        .approve(vpAssetManager.address, AMOUNT_TO_MINT);

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH);
      await mockFtsoRewardManager.setStartAndEpochId(
        CLAIMABLE_START_EPOCH,
        CLAIMABLE_END_EPOCH
      );
      await mockFtsoRewardManager.setRewardAmount(REWARD_AMOUNT);

      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(100));

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH + 1);
      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(50));
      await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT.div(70));

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH + 2);
      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(60));
      await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT.div(90));
    });

    it("fails if no new epoch to claim", async () => {
      await assertRevert(
        vpAssetManager.userCollectReward(0),
        "noEpochToClaim()"
      );

      await vpAssetManager.claimReward(0);

      await vpAssetManager.userCollectReward(0);
    });

    it("test that if epochToEnd is provided, reward will be claimed only up to epochToEnd", async () => {
      const EPOCH_TO_END = 1;

      await vpAssetManager.claimReward(0);

      const userLastClaimedEpochBefore =
        await vpAssetManager.userLastClaimedEpoch(owner.address);
      expect(userLastClaimedEpochBefore).to.equal(0);

      await vpAssetManager.userCollectReward(EPOCH_TO_END);

      const userLastClaimedEpochAfter =
        await vpAssetManager.userLastClaimedEpoch(owner.address);
      expect(userLastClaimedEpochAfter).to.equal(EPOCH_TO_END);
    });

    it("test that if epochToEnd is not provided, all available reward will be claimed", async () => {
      const EXPECTED_LAST_CLAIMED_EPOCH = 2;

      await vpAssetManager.claimReward(0);

      const userLastClaimedEpochBefore =
        await vpAssetManager.userLastClaimedEpoch(owner.address);
      expect(userLastClaimedEpochBefore).to.equal(0);

      await vpAssetManager.userCollectReward(0);

      const userLastClaimedEpochAfter =
        await vpAssetManager.userLastClaimedEpoch(owner.address);
      expect(userLastClaimedEpochAfter).to.equal(EXPECTED_LAST_CLAIMED_EPOCH);
    });

    it("test that that correct amount of tokens were transferred", async () => {
      const EXPECTED_REWARD_PER_UNIT = rdiv(
        REWARD_AMOUNT,
        AMOUNT_TO_MINT.div(100)
          .add(AMOUNT_TO_MINT.div(50))
          .add(AMOUNT_TO_MINT.div(70))
      );
      const EXPECTED_REWARD_AMOUNT = EXPECTED_REWARD_PER_UNIT.mul(
        AMOUNT_TO_MINT.div(100)
      ).div(RAY);

      await vpAssetManager.claimReward(0);

      const userBalanceBefore = await mockVpToken.balanceOf(owner.address);
      await vpAssetManager.userCollectReward(0);

      const userBalanceAfter = await mockVpToken.balanceOf(owner.address);
      expect(userBalanceAfter.sub(userBalanceBefore)).to.equal(
        EXPECTED_REWARD_AMOUNT
      );
    });
  });

  describe("collectRewardForUser  Unit Test", function () {
    const CLAIMABLE_START_EPOCH = 1;
    const CLAIMABLE_END_EPOCH = 2;
    const CURRENT_REWARD_EPOCH = 1;
    const REWARD_AMOUNT = WAD;

    beforeEach(async function () {
      await mockVpToken.mint(user.address, AMOUNT_TO_MINT);
      await mockVpToken
        .connect(user)
        .approve(vpAssetManager.address, AMOUNT_TO_MINT);

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH);
      await mockFtsoRewardManager.setStartAndEpochId(
        CLAIMABLE_START_EPOCH,
        CLAIMABLE_END_EPOCH
      );
      await mockFtsoRewardManager.setRewardAmount(REWARD_AMOUNT);

      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(100));

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH + 1);
      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(50));
      await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT.div(70));

      await mockFtsoManager.setCurrentRewardEpoch(CURRENT_REWARD_EPOCH + 2);
      await vpAssetManager.deposit(AMOUNT_TO_MINT.div(60));
      await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT.div(90));
    });

    it("fails if caller is not auctioneer", async () => {
      await vpAssetManager.claimReward(0);

      await registry
        .connect(admin)
        .register(
          bytes32("notAuctioneer"),
          auctioneerCaller.address,
          false
        );

      await assertRevert(
        vpAssetManager.collectRewardForUser(owner.address),
        "callerDoesNotHaveRequiredRole"
      );

      await registry
        .connect(admin)
        .register(bytes32("auctioneer"), auctioneerCaller.address, false);

      await vpAssetManager
        .connect(auctioneerCaller)
        .collectRewardForUser(owner.address);
    });

    it("test that all available reward will be claimed", async () => {
      const EXPECTED_LAST_CLAIMED_EPOCH = 2;

      await vpAssetManager.claimReward(0);

      const userLastClaimedEpochBefore =
        await vpAssetManager.userLastClaimedEpoch(owner.address);
      expect(userLastClaimedEpochBefore).to.equal(0);

      await vpAssetManager
        .connect(auctioneerCaller)
        .collectRewardForUser(owner.address);

      const userLastClaimedEpochAfter =
        await vpAssetManager.userLastClaimedEpoch(owner.address);
      expect(userLastClaimedEpochAfter).to.equal(EXPECTED_LAST_CLAIMED_EPOCH);
    });

    it("test that that correct amount of tokens were transferred", async () => {
      const EXPECTED_REWARD_PER_UNIT = rdiv(
        REWARD_AMOUNT,
        AMOUNT_TO_MINT.div(100)
          .add(AMOUNT_TO_MINT.div(50))
          .add(AMOUNT_TO_MINT.div(70))
      );
      const EXPECTED_REWARD_AMOUNT = EXPECTED_REWARD_PER_UNIT.mul(
        AMOUNT_TO_MINT.div(100)
      ).div(RAY);

      await vpAssetManager.claimReward(0);

      const userBalanceBefore = await mockVpToken.balanceOf(owner.address);
      await vpAssetManager
        .connect(auctioneerCaller)
        .collectRewardForUser(owner.address);

      const userBalanceAfter = await mockVpToken.balanceOf(owner.address);
      expect(userBalanceAfter.sub(userBalanceBefore)).to.equal(
        EXPECTED_REWARD_AMOUNT
      );
    });
  });

  describe("changeDataProvider  Unit Test", function () {
    it("fails if providers and pct array length is not the same", async () => {
      const NEW_DATA_PROVIDER = [owner.address, user.address];
      const NEW_DATA_PCTS = [5000, 5000];
      await assertRevert(
        vpAssetManager
          .connect(admin)
          .changeDataProviders([owner.address], NEW_DATA_PCTS),
        "providerAndPctLengthMismatch()"
      );

      await vpAssetManager
        .connect(admin)
        .changeDataProviders(NEW_DATA_PROVIDER, NEW_DATA_PCTS);
    });

    it("fails if percentages provided does not equal to 100%", async () => {
      const NEW_DATA_PROVIDER = [owner.address, user.address];
      const NEW_DATA_PCTS = [5000, 5000];
      await assertRevert(
        vpAssetManager
          .connect(admin)
          .changeDataProviders(NEW_DATA_PROVIDER, [5000, 4000]),
        "pctDoesNotAddUpToHundred()"
      );

      await vpAssetManager
        .connect(admin)
        .changeDataProviders(NEW_DATA_PROVIDER, NEW_DATA_PCTS);
    });

    it("tests that dataProviders are updated correctly", async () => {
      const NEW_DATA_PROVIDER = [owner.address, user.address];
      const NEW_DATA_PCTS = [5000, 5000];

      const dataProviderBefore = await vpAssetManager.getDataProviders();
      expect(dataProviderBefore.length).to.equal(0);
      await vpAssetManager
        .connect(admin)
        .changeDataProviders(NEW_DATA_PROVIDER, NEW_DATA_PCTS);

      const dataProviderAfter = await vpAssetManager.getDataProviders();
      expect(dataProviderAfter.length).to.equal(2);
      expect(dataProviderAfter[0]).to.equal(NEW_DATA_PROVIDER[0]);
      expect(dataProviderAfter[1]).to.equal(NEW_DATA_PROVIDER[1]);
    });
  });

  it("fails if token transferFrom failed when depositing", async () => {
    await registry
      .connect(admin)
      .register(bytes32("whitelisted"), user.address, false);

    await assertRevert(
      vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT),
      "ERC20: insufficient allowance"
    );

    await mockVpToken.mint(user.address, AMOUNT_TO_MINT);
    await mockVpToken
      .connect(user)
      .approve(vpAssetManager.address, AMOUNT_TO_MINT);

    await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT);
  });

  it("fails if token transfer failed when withdrawing", async () => {
    await registry
      .connect(admin)
      .register(bytes32("whitelisted"), user.address, false);

    await mockVpToken.mint(user.address, AMOUNT_TO_MINT);
    await mockVpToken
      .connect(user)
      .approve(vpAssetManager.address, AMOUNT_TO_MINT);

    await vpAssetManager.connect(user).deposit(AMOUNT_TO_MINT);

    await mockVpToken.burn(vpAssetManager.address, AMOUNT_TO_MINT);

    await assertRevert(
      vpAssetManager.connect(user).withdraw(AMOUNT_TO_MINT),
      "ERC20: transfer amount exceeds balance"
    );
  });

  it("test DepositVPAssetManager event is emitted properly", async () => {
    await mockVpToken.mint(owner.address, AMOUNT_TO_MINT);
    await mockVpToken.approve(vpAssetManager.address, AMOUNT_TO_MINT);
    let parsedEvents = await parseEvents(
      vpAssetManager.deposit(AMOUNT_TO_MINT),
      "DepositVPAssetManager",
      vpAssetManager
    );

    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_MINT);
  });

  it("test WithdrawVPAssetManager event is emitted properly", async () => {
    await mockVpToken.mint(owner.address, AMOUNT_TO_MINT);
    await mockVpToken.approve(vpAssetManager.address, AMOUNT_TO_MINT);
    await vpAssetManager.deposit(AMOUNT_TO_MINT);

    let parsedEvents = await parseEvents(
      vpAssetManager.withdraw(AMOUNT_TO_WITHDRAW),
      "WithdrawVPAssetManager",
      vpAssetManager
    );
    expect(parsedEvents[0].args[0]).to.equal(owner.address);
    expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_WITHDRAW);
  });
});
