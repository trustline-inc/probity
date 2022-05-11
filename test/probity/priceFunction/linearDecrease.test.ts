import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";

import { LinearDecrease } from "../../../typechain";

import { deployTest, probity } from "../../../lib/deployer";
import { ethers } from "hardhat";
import * as chai from "chai";
import {
  ADDRESS_ZERO,
  bytes32,
  RAD,
  WAD,
  RAY,
  ASSET_ID,
} from "../../utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;

// Contracts
let linearDecrease: LinearDecrease;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("LinearDecrease Unit Tests", function () {
  const STARTING_PRICE = RAY.mul(20);
  const TIME_ELAPSED = 3600 * 8; // 8 hours
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();
    // Set contracts
    linearDecrease = contracts.linearDecrease;

    owner = signers.owner;
  });

  it("tests that it returns the starting price if timeElapsed is zero", async () => {
    expect(await linearDecrease.price(STARTING_PRICE, 0)).to.equal(
      STARTING_PRICE
    );
    expect(await linearDecrease.price(STARTING_PRICE, 1)).to.not.equal(
      STARTING_PRICE
    );
  });

  it("tests that the price decrease linearly", async () => {
    let timeElapsed = 3600 * 12; // 25% of time elapased
    let expectedPrice = STARTING_PRICE.sub(STARTING_PRICE.div(4));

    expect(await linearDecrease.price(STARTING_PRICE, timeElapsed)).to.equal(
      expectedPrice
    );

    timeElapsed = 3600 * 20; // 20/48 passed
    expectedPrice = STARTING_PRICE.sub(STARTING_PRICE.mul(20).div(48));

    expect(
      (await linearDecrease.price(STARTING_PRICE, timeElapsed))
        .sub(expectedPrice)
        .abs()
        .lte(1000)
    ).to.equal(true);
  });

  it("tests that it returns zero if timeElapsed is equal or grater than timeToZero", async () => {
    const TIME_TO_ZERO = 3600 * 48; // 2 days
    expect(await linearDecrease.price(STARTING_PRICE, TIME_TO_ZERO)).to.equal(
      0
    );
    expect(
      await linearDecrease.price(STARTING_PRICE, TIME_TO_ZERO + 1)
    ).to.equal(0);
    expect(
      await linearDecrease.price(STARTING_PRICE, TIME_ELAPSED)
    ).to.not.equal(0);
  });
});
