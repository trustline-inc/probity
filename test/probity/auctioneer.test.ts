import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import {
  Liquidator,
  MockAuctioneer,
  MockFtso,
  MockReservePool,
  MockVaultEngine,
  NativeToken,
  PriceFeed,
  Auctioneer,
  Registry,
  LinearDecrease,
  ReservePool,
  Teller,
  Treasury,
  VaultEngine,
  MockPriceCalc,
} from "../../typechain";

import { deployTest, probity } from "../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import { ADDRESS_ZERO, bytes32, RAD, WAD, RAY } from "../utils/constants";
import { BigNumber } from "ethers";
import assertRevert from "../utils/assertRevert";
import { sign } from "crypto";
import parseEvents from "../utils/parseEvents";
import increaseTime from "../utils/increaseTime";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let liquidatorCaller: SignerWithAddress;

// Contracts
let vaultEngine: MockVaultEngine;
let registry: Registry;
let reservePool: ReservePool;
let auctioneer: Auctioneer;
let ftso: MockFtso;
let liquidator: Liquidator;
let priceCalc: MockPriceCalc;

let flrAssetId = bytes32("FLR");

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Auctioneer Unit Tests", function () {
  const LOT_SIZE = WAD.mul(1000);
  const DEBT_SIZE = RAD.mul(4827);
  const DEFUALT_PRICE_BUFFER = WAD.mul(120).div(100);
  const HEAD = "0x0000000000000000000000000000000000000001";
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    registry = contracts.registry;
    vaultEngine = contracts.mockVaultEngine;
    reservePool = contracts.reservePool;
    priceCalc = contracts.mockPriceCalc;
    ftso = contracts.ftso;
    liquidator = contracts.liquidator;

    contracts = await probity.deployAuctioneer({
      registry: registry,
      vaultEngine: vaultEngine.address,
      priceCalc: priceCalc.address,
      ftso: ftso.address,
      liquidator: liquidator.address,
    });

    auctioneer = contracts.auctioneer;

    owner = signers.owner;
    user1 = signers.alice;
    user2 = signers.don;
    user3 = signers.lender;
    liquidatorCaller = signers.charlie;

    await registry.setupAddress(
      bytes32("liquidator"),
      liquidatorCaller.address
    );
    await priceCalc.setPrice(RAY.mul(12).div(10));
  });

  describe("startAuction Unit Test", function () {
    it("tests that only liquidator can call startAuction", async () => {
      const COLL_OWNER = user1.address;
      const BENEFICIARY = reservePool.address;

      await assertRevert(
        auctioneer.startAuction(
          flrAssetId,
          LOT_SIZE,
          DEBT_SIZE,
          COLL_OWNER,
          BENEFICIARY
        ),
        "AccessControl/onlyBy: Caller does not have permission"
      );

      await registry.setupAddress(bytes32("liquidator"), user1.address);

      await auctioneer
        .connect(user1)
        .startAuction(flrAssetId, LOT_SIZE, DEBT_SIZE, COLL_OWNER, BENEFICIARY);
    });

    it("tests that auction object is created properly", async () => {
      const COLL_OWNER = user1.address;
      const BENEFICIARY = reservePool.address;
      const EXPECTED_START_PRICE = DEFUALT_PRICE_BUFFER.mul(1e9);

      const before = await auctioneer.auctions(0);
      expect(before.collId).to.equal(bytes32(""));
      expect(before.lot).to.equal(0);
      expect(before.debt).to.equal(0);
      expect(before.owner).to.equal(ADDRESS_ZERO);
      expect(before.beneficiary).to.equal(ADDRESS_ZERO);
      expect(before.startPrice).to.equal(0);
      expect(before.startTime).to.equal(0);
      expect(before.isOver).to.equal(false);

      await auctioneer
        .connect(liquidatorCaller)
        .startAuction(flrAssetId, LOT_SIZE, DEBT_SIZE, COLL_OWNER, BENEFICIARY);

      const after = await auctioneer.auctions(0);
      expect(after.collId).to.equal(flrAssetId);
      expect(after.lot).to.equal(LOT_SIZE);
      expect(after.debt).to.equal(DEBT_SIZE);
      expect(after.owner).to.equal(COLL_OWNER);
      expect(after.beneficiary).to.equal(BENEFICIARY);
      expect(after.startPrice).to.equal(EXPECTED_START_PRICE);
      expect(
        after.startTime
          .sub((Date.now() / 1000).toFixed(0))
          .abs()
          .lte(60000)
      ).to.equal(true);
      expect(after.isOver).to.equal(false);
    });

    it("tests that AuctionStarted Event is emitted", async () => {
      const COLL_OWNER = user1.address;
      const BENEFICIARY = reservePool.address;
      const parsedEvents = await parseEvents(
        auctioneer
          .connect(liquidatorCaller)
          .startAuction(
            flrAssetId,
            LOT_SIZE,
            DEBT_SIZE,
            COLL_OWNER,
            BENEFICIARY
          ),
        "AuctionStarted",
        auctioneer
      );

      expect(parsedEvents[0].args.collId).to.equal(flrAssetId);
      expect(parsedEvents[0].args.auctionId).to.equal(0);
      expect(parsedEvents[0].args.lotSize).to.equal(LOT_SIZE);
    });
  });

  describe("placeBid Unit Test", function () {
    beforeEach(async function () {
      await auctioneer
        .connect(liquidatorCaller)
        .startAuction(
          flrAssetId,
          LOT_SIZE,
          DEBT_SIZE,
          user1.address,
          reservePool.address
        );

      await vaultEngine.updateVault(
        flrAssetId,
        auctioneer.address,
        LOT_SIZE,
        0,
        0,
        0,
        0,
        0
      );
      await vaultEngine.addStablecoin(owner.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user1.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user2.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user3.address, RAD.mul(1000000));
    });

    it("fails if auction is over", async () => {
      await auctioneer.placeBid(0, RAY, LOT_SIZE.div(10));
      await auctioneer.buyItNow(0, RAY.mul(2), LOT_SIZE);

      await assertRevert(
        auctioneer.connect(user1).placeBid(0, RAY, LOT_SIZE.div(10)),
        "Auctioneer/placeBid: Auction is over"
      );
    });

    it("fails if user already placed a bid", async () => {
      await auctioneer.placeBid(0, RAY, LOT_SIZE.div(10));

      await assertRevert(
        auctioneer.placeBid(0, RAY, LOT_SIZE.div(10)),
        "Auctioneer/placeBid: This user has already placed a bid"
      );
    });

    it("tests that proper values are updated", async () => {
      const EXPECTED_BID_LOT_SIZE = LOT_SIZE.div(10);
      const EXPECTED_BID_PRICE = RAY;

      const auctionBefore = await auctioneer.bids(0, owner.address);
      expect(auctionBefore.lot).to.equal(0);
      expect(auctionBefore.price).to.equal(0);

      await auctioneer.placeBid(0, RAY, LOT_SIZE.div(10));

      const auctionAfter = await auctioneer.bids(0, owner.address);
      expect(auctionAfter.lot).to.equal(EXPECTED_BID_LOT_SIZE);
      expect(auctionAfter.price).to.equal(EXPECTED_BID_PRICE);
    });

    it("tests that proper amount of aurei is transferred from bidder's vault", async () => {
      const BID_LOT_SIZE = LOT_SIZE.div(10);
      const EXEPCTED_AUREI_AMOUNT_TRANSFERRED = RAY.mul(BID_LOT_SIZE);

      const before = await vaultEngine.stablecoin(owner.address);

      await auctioneer.placeBid(0, RAY, BID_LOT_SIZE);

      const after = await vaultEngine.stablecoin(owner.address);
      expect(before.sub(after)).to.equal(EXEPCTED_AUREI_AMOUNT_TRANSFERRED);
    });

    it("new bid is added at the correct index", async () => {
      const BID_LOT_SIZE = LOT_SIZE.div(10);
      const before = await auctioneer.nextHighestBidder(0, HEAD);
      expect(before).to.equal(ADDRESS_ZERO);

      await auctioneer.connect(user1).placeBid(0, RAY.div(5), BID_LOT_SIZE);

      let after = await auctioneer.nextHighestBidder(0, HEAD);
      expect(after).to.equal(user1.address);

      await auctioneer.connect(user2).placeBid(0, RAY.div(2), BID_LOT_SIZE);
      after = await auctioneer.nextHighestBidder(0, HEAD);
      expect(after).to.equal(user2.address);
      after = await auctioneer.nextHighestBidder(0, user1.address);
      expect(after).to.equal(ADDRESS_ZERO);

      await auctioneer.placeBid(0, RAY.div(3), BID_LOT_SIZE);
      after = await auctioneer.nextHighestBidder(0, user2.address);
      expect(after).to.equal(owner.address);

      await auctioneer.connect(user3).placeBid(0, RAY.div(10), BID_LOT_SIZE);

      after = await auctioneer.nextHighestBidder(0, user1.address);
      expect(after).to.equal(user3.address);
    });

    it("tests that old bids below the max debt to raise is canceled or modified", async () => {
      const AUCTION_ID = 0;
      const before = await auctioneer.nextHighestBidder(AUCTION_ID, HEAD);
      expect(before).to.equal(ADDRESS_ZERO);

      await auctioneer
        .connect(user1)
        .placeBid(0, RAY.div(10), LOT_SIZE.mul(4).div(10));
      await auctioneer
        .connect(user2)
        .placeBid(0, RAY.div(5), LOT_SIZE.mul(4).div(10));

      let EXPECTED_BID_PRICE = RAY.div(10);
      let EXPECTED_LOT_SIZE = LOT_SIZE.mul(4).div(10);
      let bidBefore = await auctioneer.bids(AUCTION_ID, user1.address);
      expect(bidBefore.price).to.equal(EXPECTED_BID_PRICE);
      expect(bidBefore.lot).to.equal(EXPECTED_LOT_SIZE);

      await auctioneer
        .connect(user3)
        .placeBid(0, RAY.div(6), LOT_SIZE.mul(5).div(10));

      EXPECTED_LOT_SIZE = LOT_SIZE.div(10);
      let bidAfter = await auctioneer.bids(AUCTION_ID, user1.address);
      expect(bidBefore.price).to.equal(EXPECTED_BID_PRICE);
      expect(bidAfter.lot).to.equal(EXPECTED_LOT_SIZE);

      await auctioneer.placeBid(0, RAY.div(2), LOT_SIZE);
      let user1Bid = await auctioneer.bids(AUCTION_ID, user1.address);
      expect(user1Bid.price).to.equal(0);
      expect(user1Bid.lot).to.equal(0);
      let user2Bid = await auctioneer.bids(AUCTION_ID, user2.address);
      expect(user2Bid.price).to.equal(0);
      expect(user2Bid.lot).to.equal(0);
      let user3Bid = await auctioneer.bids(AUCTION_ID, user3.address);
      expect(user3Bid.price).to.equal(0);
      expect(user3Bid.lot).to.equal(0);
    });

    it("tests that bid is adjusted to if bidAbleAmount < bidLot * bidPrice", async () => {
      const AUCTION_ID = 0;
      const EXPECTED_BID_PRICE = RAY.div(5);
      const EXPECTED_BID_LOT = LOT_SIZE.div(10);

      await auctioneer.connect(user1).placeBid(0, RAY, LOT_SIZE.mul(9).div(10));

      await auctioneer
        .connect(user2)
        .placeBid(0, EXPECTED_BID_PRICE, LOT_SIZE.mul(4).div(10));

      const after = await auctioneer.bids(AUCTION_ID, user2.address);
      expect(after.price).to.equal(EXPECTED_BID_PRICE);
      expect(after.lot).to.equal(EXPECTED_BID_LOT);
    });
  });

  describe("buyItNow Unit Test", function () {
    beforeEach(async function () {
      await priceCalc.setPrice(RAY.mul(12).div(10));
      await auctioneer
        .connect(liquidatorCaller)
        .startAuction(
          flrAssetId,
          LOT_SIZE,
          DEBT_SIZE,
          user1.address,
          reservePool.address
        );

      await vaultEngine.updateVault(
        flrAssetId,
        auctioneer.address,
        LOT_SIZE,
        0,
        0,
        0,
        0,
        0
      );
      await vaultEngine.addStablecoin(owner.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user1.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user2.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user3.address, RAD.mul(1000000));
    });

    it("fails if auction is over", async () => {
      await auctioneer.buyItNow(0, RAY.mul(2), LOT_SIZE);

      await assertRevert(
        auctioneer.connect(user1).buyItNow(0, RAY.mul(2), LOT_SIZE),
        "Auctioneer/buyItNow: Auction is over"
      );
    });

    it("fails if current price is higher than max buyItNow price", async () => {
      await assertRevert(
        auctioneer.connect(user1).buyItNow(0, RAY, LOT_SIZE.div(10)),
        "Auctioneer/buyItNow: Current price is higher than max price"
      );

      await auctioneer.buyItNow(0, RAY.mul(12).div(10), LOT_SIZE);
    });

    it("fails if currentPrice is 0", async () => {
      await priceCalc.setPrice(0);

      await assertRevert(
        auctioneer.connect(user1).buyItNow(0, RAY, LOT_SIZE.div(10)),
        "Auctioneer/buyItNow: Current price is now zero"
      );
    });

    it("fails if buyItNow is no longer available because of existing bids", async () => {
      await auctioneer
        .connect(user1)
        .placeBid(0, RAY.mul(12).div(10), LOT_SIZE);
      await priceCalc.setPrice(RAY.mul(5).div(10));

      await assertRevert(
        auctioneer.connect(user1).buyItNow(0, RAY.mul(5), LOT_SIZE.div(10)),
        "Auctioneer/buyItNow: Price has reach a point where BuyItNow is no longer available"
      );
    });

    it("tests that correct amount of Aurei is retrieved from user", async () => {
      const BID_LOT_SIZE = LOT_SIZE.div(10);
      const EXEPCTED_AUREI_AMOUNT_TRANSFERRED = RAY.mul(12)
        .div(10)
        .mul(BID_LOT_SIZE);

      const before = await vaultEngine.stablecoin(owner.address);

      await auctioneer.buyItNow(0, RAY.mul(12).div(10), BID_LOT_SIZE);

      const after = await vaultEngine.stablecoin(owner.address);
      expect(before.sub(after)).to.equal(EXEPCTED_AUREI_AMOUNT_TRANSFERRED);
    });

    it("tests that correct amount of collateral is sent to user", async () => {
      const EXPECTED_LOT_SIZE = LOT_SIZE.div(10);

      const before = await vaultEngine.vaults(flrAssetId, owner.address);

      await auctioneer.buyItNow(0, RAY.mul(12).div(10), EXPECTED_LOT_SIZE);

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standby.add(after.standby)).to.equal(EXPECTED_LOT_SIZE);
    });

    it("tests that it cancel old bids that are no longer in contention", async () => {
      const AUCTION_ID = 0;
      const before = await auctioneer.nextHighestBidder(AUCTION_ID, HEAD);
      expect(before).to.equal(ADDRESS_ZERO);

      await auctioneer
        .connect(user1)
        .placeBid(0, RAY.div(10), LOT_SIZE.mul(4).div(10));
      await auctioneer
        .connect(user2)
        .placeBid(0, RAY.div(5), LOT_SIZE.mul(4).div(10));

      await auctioneer.buyItNow(0, RAY.mul(12).div(10), LOT_SIZE);
      let user1Bid = await auctioneer.bids(AUCTION_ID, user1.address);
      expect(user1Bid.price).to.equal(0);
      expect(user1Bid.lot).to.equal(0);
      let user2Bid = await auctioneer.bids(AUCTION_ID, user2.address);
      expect(user2Bid.price).to.equal(0);
      expect(user2Bid.lot).to.equal(0);
      let user3Bid = await auctioneer.bids(AUCTION_ID, user3.address);
      expect(user3Bid.price).to.equal(0);
      expect(user3Bid.lot).to.equal(0);
    });

    it("tests that values are updated correctly", async () => {
      const BUY_LOT_SIZE = LOT_SIZE.mul(99).div(100);
      const BUY_VALUE = RAY.mul(12).div(10).mul(BUY_LOT_SIZE);

      const before = await auctioneer.auctions(0);
      expect(before.debt).to.equal(DEBT_SIZE);
      expect(before.lot).to.equal(LOT_SIZE);

      await auctioneer.buyItNow(
        0,
        RAY.mul(12).div(10),
        LOT_SIZE.mul(99).div(100)
      );

      const after = await auctioneer.auctions(0);
      expect(after.debt).to.equal(DEBT_SIZE.sub(BUY_VALUE));
      expect(after.lot).to.equal(LOT_SIZE.sub(BUY_LOT_SIZE));
    });
  });

  describe("finalizeSale Unit Test", function () {
    beforeEach(async function () {
      await auctioneer
        .connect(liquidatorCaller)
        .startAuction(
          flrAssetId,
          LOT_SIZE,
          DEBT_SIZE,
          user1.address,
          reservePool.address
        );

      await vaultEngine.updateVault(
        flrAssetId,
        auctioneer.address,
        LOT_SIZE,
        0,
        0,
        0,
        0,
        0
      );
      await vaultEngine.addStablecoin(owner.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user1.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user2.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user3.address, RAD.mul(1000000));
    });

    it("fails if caller has no bid", async () => {
      await assertRevert(
        auctioneer.finalizeSale(0),
        "Auctioneer/finalizeSale: The caller has no active bids"
      );

      await auctioneer.placeBid(0, RAY.mul(12).div(10), LOT_SIZE.div(10));
      await priceCalc.setPrice(RAY);

      await auctioneer.finalizeSale(0);
    });

    it("fails if current price has not passed the bid price", async () => {
      await auctioneer.placeBid(0, RAY, LOT_SIZE.div(10));

      await assertRevert(
        auctioneer.finalizeSale(0),
        "Auctioneer/finalizeSale: The current price has not passed the bid price"
      );
    });

    it("tests that correct amount of collateral is sent to user", async () => {
      const EXPECTED_LOT_SIZE = LOT_SIZE.div(10);

      await auctioneer.placeBid(0, RAY, EXPECTED_LOT_SIZE);

      await priceCalc.setPrice(RAY.mul(9).div(10));
      const before = await vaultEngine.vaults(flrAssetId, owner.address);

      await auctioneer.finalizeSale(0);

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standby.add(after.standby)).to.equal(EXPECTED_LOT_SIZE);
    });

    it("tests that it values are updated correctly", async () => {
      const BUY_LOT_SIZE = LOT_SIZE.mul(99).div(100);
      const BUY_VALUE = RAY.mul(12).div(10).mul(BUY_LOT_SIZE);

      await auctioneer.placeBid(0, RAY.mul(12).div(10), BUY_LOT_SIZE);
      await priceCalc.setPrice(RAY.mul(7).div(10));

      const before = await auctioneer.auctions(0);
      expect(before.debt).to.equal(DEBT_SIZE);
      expect(before.lot).to.equal(LOT_SIZE);

      await auctioneer.finalizeSale(0);

      const after = await auctioneer.auctions(0);
      expect(after.debt).to.equal(DEBT_SIZE.sub(BUY_VALUE));
      expect(after.lot).to.equal(LOT_SIZE.sub(BUY_LOT_SIZE));
    });

    it("tests that bid index is removed correctly", async () => {
      await auctioneer
        .connect(user1)
        .placeBid(0, RAY.div(10), LOT_SIZE.mul(4).div(10));
      await auctioneer
        .connect(user2)
        .placeBid(0, RAY.div(5), LOT_SIZE.mul(4).div(10));
      await auctioneer
        .connect(user3)
        .placeBid(0, RAY.div(4), LOT_SIZE.mul(3).div(10));

      await priceCalc.setPrice(RAY.div(11));

      const before = await auctioneer.nextHighestBidder(0, user2.address);
      expect(before).to.equal(user1.address);

      await auctioneer.connect(user1).finalizeSale(0);

      const after = await auctioneer.nextHighestBidder(0, user2.address);
      expect(after).to.equal(ADDRESS_ZERO);
    });

    it("tests that Sale Event is emitted correctly", async () => {
      const COLL_OWNER = owner.address;
      const EXPECTED_LOT_SIZE = LOT_SIZE.div(10);
      await auctioneer.placeBid(0, RAY, EXPECTED_LOT_SIZE);
      await priceCalc.setPrice(RAY.mul(7).div(10));

      const parsedEvents = await parseEvents(
        auctioneer.finalizeSale(0),
        "Sale",
        auctioneer
      );

      expect(parsedEvents[0].args.collId).to.equal(flrAssetId);
      expect(parsedEvents[0].args.auctionId).to.equal(0);
      expect(parsedEvents[0].args.user).to.equal(COLL_OWNER);
      expect(parsedEvents[0].args.price).to.equal(RAY);
      expect(parsedEvents[0].args.lotSize).to.equal(EXPECTED_LOT_SIZE);
    });
  });

  describe("calculatePrice Unit Test", function () {
    it("tests that it calls the priceCalc's price function with correct parameter", async () => {
      await auctioneer
        .connect(liquidatorCaller)
        .startAuction(
          flrAssetId,
          LOT_SIZE,
          DEBT_SIZE,
          user1.address,
          reservePool.address
        );

      const startingPriceBefore = await priceCalc.lastStartingPrice();
      expect(startingPriceBefore).to.equal(0);
      const timeElapsedBefore = await priceCalc.lastTimeElapsed();
      expect(timeElapsedBefore).to.equal(0);

      await auctioneer.calculatePrice(0);

      const startingPriceAfter = await priceCalc.lastStartingPrice();
      expect(startingPriceAfter).to.equal(RAY.mul(12).div(10));
      const startingTime = (await auctioneer.auctions(0)).startTime;
      const timeElapsedAfter = await priceCalc.lastTimeElapsed();
      const EXPECTED_TIME_ELAPSED = BigNumber.from(
        (Date.now() / 1000).toFixed(0).toString()
      ).sub(startingTime);
      expect(
        timeElapsedAfter.sub(EXPECTED_TIME_ELAPSED).abs().lte(60000)
      ).to.equal(true);
    });
  });

  describe("cancelAuction Unit Test", function () {
    const DEBT_ON_AUCTION = RAD.mul(100000000);
    beforeEach(async function () {
      await auctioneer
        .connect(liquidatorCaller)
        .startAuction(
          flrAssetId,
          LOT_SIZE,
          DEBT_SIZE,
          user1.address,
          reservePool.address
        );

      await reservePool
        .connect(liquidatorCaller)
        .addAuctionDebt(DEBT_ON_AUCTION);

      await vaultEngine.updateVault(
        flrAssetId,
        auctioneer.address,
        LOT_SIZE,
        0,
        0,
        0,
        0,
        0
      );
      await vaultEngine.addStablecoin(owner.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user1.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user2.address, RAD.mul(1000000));
      await vaultEngine.addStablecoin(user3.address, RAD.mul(1000000));
    });

    it("tests that only Probity can call the function", async () => {
      await assertRevert(
        auctioneer.connect(user1).cancelAuction(0, owner.address),
        "AccessControl/onlyByProbity: Caller must be from Probity system contract"
      );

      await auctioneer
        .connect(liquidatorCaller)
        .cancelAuction(0, owner.address);
    });

    it("tests that values are properly updated", async () => {
      const before = await auctioneer.auctions(0);
      expect(before.debt).to.equal(DEBT_SIZE);
      expect(before.lot).to.equal(LOT_SIZE);

      await auctioneer.cancelAuction(0, owner.address);

      const after = await auctioneer.auctions(0);
      expect(after.debt).to.equal(0);
      expect(after.lot).to.equal(0);
    });

    it("tests that recipient gets the all the collateral held", async () => {
      const before = await vaultEngine.vaults(flrAssetId, owner.address);

      await auctioneer.cancelAuction(0, owner.address);

      const after = await vaultEngine.vaults(flrAssetId, owner.address);
      expect(before.standby.add(after.standby)).to.equal(LOT_SIZE);
    });

    it("tests that all the bids are cancelled", async () => {
      await auctioneer
        .connect(user1)
        .placeBid(0, RAY.div(10), LOT_SIZE.mul(4).div(10));
      await auctioneer
        .connect(user2)
        .placeBid(0, RAY.div(5), LOT_SIZE.mul(4).div(10));
      await auctioneer
        .connect(user3)
        .placeBid(0, RAY.div(6), LOT_SIZE.mul(5).div(10));

      await auctioneer
        .connect(liquidatorCaller)
        .cancelAuction(0, owner.address);
      let user1Bid = await auctioneer.bids(0, user1.address);
      expect(user1Bid.price).to.equal(0);
      expect(user1Bid.lot).to.equal(0);
      let user2Bid = await auctioneer.bids(0, user2.address);
      expect(user2Bid.price).to.equal(0);
      expect(user2Bid.lot).to.equal(0);
      let user3Bid = await auctioneer.bids(0, user3.address);
      expect(user3Bid.price).to.equal(0);
      expect(user3Bid.lot).to.equal(0);
    });

    it("tests it reduces auction debt of the reservePool", async () => {
      const before = await reservePool.debtOnAuction();
      expect(before).to.equal(DEBT_ON_AUCTION);

      await auctioneer
        .connect(liquidatorCaller)
        .cancelAuction(0, owner.address);

      const after = await reservePool.debtOnAuction();
      expect(after).to.equal(DEBT_ON_AUCTION.sub(DEBT_SIZE));
    });
  });
});
