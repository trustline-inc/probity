import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import { Aurei, Bridge, Registry, StateConnector } from "../typechain";
import { deployBridgeSystem } from "../lib/deployer";
import { ethers, web3 } from "hardhat";
import * as chai from "chai";
import {
  errorTypes,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  bytes32,
} from "./utils/constants";
import assertRevert from "./utils/assertRevert";
const expect = chai.expect;

const AMOUNT_TO_ISSUE = 10;
// Wallets
let issuer: string;
let redeemer: SignerWithAddress;
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let aurei: Aurei;
let bridge: Bridge;
let stateConnector: StateConnector;
let registry: Registry;
let txHash: any;
let currencyHash: any;
let source: any;
let destinationTag: any;

describe("Bridge", function () {
  enum statuses {
    NON_EXISTENT,
    PENDING,
    CANCELED,
    COMPLETED,
    VERIFIED,
    REDEEMED,
    FRAUDULENT,
  }
  beforeEach(async function () {
    const { contracts, signers } = await deployBridgeSystem();

    // Set contracts
    aurei = contracts.aurei;
    bridge = contracts.bridge;
    stateConnector = contracts.stateConnector;
    registry = contracts.registry;

    // we have to add the owner as 'vault' because aurei.mint can only be called by the vault address
    await registry.setupContractAddress(
      bytes32("treasury"),
      signers.owner.address
    );
    await aurei.mint(signers.owner.address, 10000);
    await aurei.approve(bridge.address, 10000);

    await stateConnector.setFinality(true);
    issuer = "rDfB33LHNMmWSUHoXUd2pj1oJxsDZ7e2dn";
    redeemer = signers.charlie;
    owner = signers.owner;
    user = signers.alice;
    txHash = web3.utils.keccak256("tx hash");
    currencyHash = web3.utils.keccak256("currency hash");
    source = "source";
    destinationTag = 0;
  });

  describe("getIssuerStatus", async function () {
    it("checks that NON_EXISTENT issuer status is returned correctly", async () => {
      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.NON_EXISTENT);

      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.PENDING);
    });

    it("checks that CANCELED issuer status is returned correctly", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.PENDING);

      await bridge.cancelIssuer(issuer);

      status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.CANCELED);
    });

    it("checks that COMPLETE issuer status is returned correctly", async () => {
      const txHash = web3.utils.keccak256("some hash");

      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.PENDING);

      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
      status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.COMPLETED);
    });

    it.skip("checks that VERIFIED issuer status is returned correctly", async () => {
      // not yet possible until that functionality is implemented
    });

    it("checks that REDEEMED issuer status is returned correctly", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.COMPLETED);

      await bridge.createRedemptionReservation(source, issuer, 0);
      await bridge.completeRedemption(
        web3.utils.keccak256("second tx hash"),
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash,
        redeemer.address
      );

      status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.REDEEMED);
    });

    it("checks that FRAUD issuer status is returned correctly", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
      await bridge.proveFraud(
        web3.utils.keccak256("second tx hash"),
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.FRAUDULENT);
    });
  });

  describe("createIssuer", async function () {
    it("fails if issuer already exists", async () => {
      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.NON_EXISTENT);
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.PENDING);
      await assertRevert(
        bridge.createIssuer(issuer, AMOUNT_TO_ISSUE),
        errorTypes.ISSUER_EXISTS
      );
    });

    it("fails if amount is non-zero", async () => {
      await assertRevert(
        bridge.createIssuer(issuer, 0),
        errorTypes.NON_ZERO_AMOUNT
      );
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
    });

    it("fails if user doesn't have enough allowance", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      const bridgeUser = bridge.connect(user);
      const secondIssuer = "secondIssuer";

      await assertRevert(
        bridgeUser.createIssuer(secondIssuer, AMOUNT_TO_ISSUE),
        errorTypes.AUR_NO_BALANCE
      );
    });

    it("checks that correct values are stored", async () => {
      let issuerResult = await bridge.issuers(issuer);
      expect(issuerResult[0].toString()).to.equal("0");
      expect(issuerResult[1]).to.equal(ADDRESS_ZERO);
      expect(issuerResult[2]).to.equal(BYTES32_ZERO);
      expect(issuerResult[3]).to.equal(statuses.NON_EXISTENT);
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      issuerResult = await bridge.issuers(issuer);
      expect(issuerResult[0].toString()).to.equal(AMOUNT_TO_ISSUE.toString());
      expect(issuerResult[1]).to.equal(owner.address);
      expect(issuerResult[2]).to.equal(BYTES32_ZERO);
      expect(issuerResult[3]).to.equal(statuses.PENDING);
    });
  });

  describe("cancelIssuer", async function () {
    it("fail if issuer does NOT exists", async () => {
      await assertRevert(
        bridge.cancelIssuer(issuer),
        errorTypes.ISSUER_NON_EXISTENT
      );
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.cancelIssuer(issuer);
    });

    it("fail if issuer is not in PENDING status", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
      await assertRevert(
        bridge.cancelIssuer(issuer),
        errorTypes.ISSUER_NOT_PENDING
      );
    });

    it("fail if caller is not the one that created the issuance", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      const bridgeUser = bridge.connect(user);
      await assertRevert(
        bridgeUser.cancelIssuer(issuer),
        errorTypes.ONLY_ORIGINAL_SENDER
      );
      // await bridge.cancelIssuer(issuer)
    });

    it("checks that AUR is transferred back to sender", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      const before = await aurei.balanceOf(owner.address);
      await bridge.cancelIssuer(issuer);
      const after = await aurei.balanceOf(owner.address);
      expect(after.toNumber() - before.toNumber()).to.equal(AMOUNT_TO_ISSUE);
    });

    it("checks that issuance is marked CANCELLED", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      let status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.PENDING);

      await bridge.cancelIssuer(issuer);

      status = await bridge.getIssuerStatus(issuer);
      expect(status).to.equal(statuses.CANCELED);
    });
  });

  describe("completeIssuance", async function () {
    it("fails if issuance is not PENDING state", async () => {
      await assertRevert(
        bridge.completeIssuance(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash
        ),
        errorTypes.ISSUER_NOT_PENDING
      );
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
    });

    it("fails payment hasn't been proven on stateConnector", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await stateConnector.setFinality(false);
      await assertRevert(
        bridge.completeIssuance(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash
        ),
        errorTypes.PAYMENT_NOT_PROVEN
      );
      await stateConnector.setFinality(true);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
    });

    it("check that the variables changed correctly", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);

      let issuerResult = await bridge.issuers(issuer);
      expect(issuerResult[0].toString()).to.equal(AMOUNT_TO_ISSUE.toString());
      expect(issuerResult[1]).to.equal(owner.address);
      expect(issuerResult[2]).to.equal(BYTES32_ZERO);
      expect(issuerResult[3]).to.equal(statuses.PENDING);

      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      issuerResult = await bridge.issuers(issuer);
      expect(issuerResult[0].toString()).to.equal(AMOUNT_TO_ISSUE.toString());
      expect(issuerResult[1]).to.equal(owner.address);
      expect(issuerResult[2]).to.equal(txHash);
      expect(issuerResult[3]).to.equal(statuses.COMPLETED);
    });

    it("checks that Issuance Completed is emitted properly", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      const tx = await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      let receipt = await tx.wait();
      let events = receipt.events?.filter((x) => {
        return x.event == "IssuanceCompleted";
      });
      let parsedEvents = events.map((e) => bridge.interface.parseLog(e));
      expect(parsedEvents[0].args[0]).to.equal(issuer);
      expect(parsedEvents[0].args[1]).to.equal(AMOUNT_TO_ISSUE);
    });
  });

  describe("proveFraud", async function () {
    it("fail if tx has already been proven", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      await assertRevert(
        bridge.proveFraud(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash
        ),
        errorTypes.TX_ID_ALREADY_PROVEN
      );

      await bridge.proveFraud(
        web3.utils.keccak256("second tx hash"),
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
    });

    it("fails payment hasn't been proven on stateConnector", async () => {
      const secondtxHash = web3.utils.keccak256("second tx hash");
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
      await stateConnector.setFinality(false);
      await assertRevert(
        bridge.proveFraud(
          secondtxHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash
        ),
        errorTypes.PAYMENT_NOT_PROVEN
      );

      await stateConnector.setFinality(true);
      await bridge.proveFraud(
        secondtxHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
    });

    it("check that correct variables are updated", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      let issuerResult = await bridge.issuers(issuer);
      expect(issuerResult[0].toString()).to.equal(AMOUNT_TO_ISSUE.toString());
      expect(issuerResult[1]).to.equal(owner.address);
      expect(issuerResult[2]).to.equal(txHash);
      expect(issuerResult[3]).to.equal(statuses.COMPLETED);

      await bridge.proveFraud(
        web3.utils.keccak256("second tx hash"),
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      issuerResult = await bridge.issuers(issuer);
      expect(issuerResult[0].toString()).to.equal("0");
      expect(issuerResult[1]).to.equal(owner.address);
      expect(issuerResult[2]).to.equal(txHash);
      expect(issuerResult[3]).to.equal(statuses.FRAUDULENT);
    });

    it("check that correct amount of AUR is sent to the caller", async () => {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      const bridgeUser = bridge.connect(user);

      const before = await aurei.balanceOf(user.address);
      await bridgeUser.proveFraud(
        web3.utils.keccak256("second tx hash"),
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
      const after = await aurei.balanceOf(user.address);
      expect(after.toNumber() - before.toNumber()).to.equal(AMOUNT_TO_ISSUE);
    });
  });

  describe("redemptionReservation", async function () {
    beforeEach(async function () {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );
    });

    it("fails if the redemptionReservation has already be placing within the last hour", async () => {
      await bridge.createRedemptionReservation(source, issuer, 0);
      await assertRevert(
        bridge.createRedemptionReservation(source, issuer, 0),
        errorTypes.TWO_HOURS_NOT_PASSED
      );
      await ethers.provider.send("evm_increaseTime", [7201]);
      await ethers.provider.send("evm_mine", []);

      await bridge.createRedemptionReservation(source, issuer, 0);
    });

    it("make sure proper variables are updated", async () => {
      const redemptionHash = await bridge.createRedemptionReservationHash(
        source,
        issuer,
        0
      );
      let issuerResult = await bridge.reservations(redemptionHash);
      expect(issuerResult[0]).to.equal(ADDRESS_ZERO);
      expect(issuerResult[1]).to.equal(0);

      await bridge.createRedemptionReservation(source, issuer, 0);

      issuerResult = await bridge.reservations(redemptionHash);
      expect(issuerResult[0]).to.equal(owner.address);
      // we'll accept it, as long as it's no longer zero because we have time skips, it's impossible to pinpoint the variable
      expect(issuerResult[1].toNumber()).to.be.greaterThan(0);
    });
  });

  describe("completeRedemption", async function () {
    beforeEach(async function () {
      await bridge.createIssuer(issuer, AMOUNT_TO_ISSUE);
      await bridge.completeIssuance(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash
      );

      await bridge.createRedemptionReservation(source, issuer, 0);
    });

    it("fail if destination address is zero address", async () => {
      await assertRevert(
        bridge.completeRedemption(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash,
          ADDRESS_ZERO
        ),
        errorTypes.NON_ZERO_DESTINATION_ADDRESS
      );

      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash,
        redeemer.address
      );
    });

    it("fail if txHash has already been redeemed", async () => {
      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash,
        redeemer.address
      );

      await assertRevert(
        bridge.completeRedemption(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash,
          redeemer.address
        ),
        errorTypes.TX_ID_ALREADY_REDEEMED
      );
    });

    it("fail if no redemption attempt entry found", async () => {
      const bridgeUser = bridge.connect(user);
      await assertRevert(
        bridgeUser.completeRedemption(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash,
          redeemer.address
        ),
        errorTypes.ONLY_REDEEMER
      );

      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash,
        redeemer.address
      );
    });

    it("fails payment hasn't been proven on stateConnector", async () => {
      await stateConnector.setFinality(false);
      await assertRevert(
        bridge.completeRedemption(
          txHash,
          source,
          issuer,
          0,
          AMOUNT_TO_ISSUE,
          currencyHash,
          redeemer.address
        ),
        errorTypes.PAYMENT_NOT_PROVEN
      );

      await stateConnector.setFinality(true);
      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_ISSUE,
        currencyHash,
        redeemer.address
      );
    });

    it("check that correct amount of AUR is sent to the caller", async () => {
      const AMOUNT_TO_WITHDRAW = 4;
      const before = await aurei.balanceOf(redeemer.address);
      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_WITHDRAW,
        currencyHash,
        redeemer.address
      );
      const after = await aurei.balanceOf(redeemer.address);
      expect(after.toNumber() - before.toNumber()).to.equal(AMOUNT_TO_WITHDRAW);
    });

    it("check that issuer's amount is reduced appropriately", async () => {
      const AMOUNT_TO_WITHDRAW = 4;
      const before = await bridge.issuers(issuer);
      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_WITHDRAW,
        currencyHash,
        redeemer.address
      );
      const after = await bridge.issuers(issuer);
      expect(before[0].toNumber() - after[0].toNumber()).to.equal(
        AMOUNT_TO_WITHDRAW
      );
    });

    it("check that if redeem makes the issuer's amount zero, it's changed to REDEEMED", async () => {
      const AMOUNT_TO_WITHDRAW = 10;
      const before = await bridge.issuers(issuer);
      expect(before[3]).to.equal(statuses.COMPLETED);
      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_WITHDRAW,
        currencyHash,
        redeemer.address
      );
      const after = await bridge.issuers(issuer);
      expect(after[3]).to.equal(statuses.REDEEMED);
    });

    it("check the redemption entry is created", async () => {
      const AMOUNT_TO_WITHDRAW = 6;
      let redemptionResult = await bridge.redemptions(txHash);
      expect(redemptionResult[0]).to.equal("");
      expect(redemptionResult[1]).to.equal("");
      expect(redemptionResult[2]).to.equal(0);
      expect(redemptionResult[3]).to.equal(0);
      expect(redemptionResult[4]).to.equal(ADDRESS_ZERO);
      expect(redemptionResult[5]).to.equal(ADDRESS_ZERO);

      await bridge.completeRedemption(
        txHash,
        source,
        issuer,
        0,
        AMOUNT_TO_WITHDRAW,
        currencyHash,
        redeemer.address
      );

      redemptionResult = await bridge.redemptions(txHash);
      expect(redemptionResult[0]).to.equal(source);
      expect(redemptionResult[1]).to.equal(issuer);
      expect(redemptionResult[2]).to.equal(destinationTag);
      expect(redemptionResult[3]).to.equal(AMOUNT_TO_WITHDRAW);
      expect(redemptionResult[4]).to.equal(redeemer.address);
      expect(redemptionResult[5]).to.equal(owner.address);
    });
  });
});
