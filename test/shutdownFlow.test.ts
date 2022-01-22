import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import {
  Aurei,
  ERC20Token,
  VaultEngine,
  NativeToken,
  Teller,
  Treasury,
  MockFtso,
  PriceFeed,
  Auctioneer,
  Liquidator,
  ReservePool,
  Registry,
  MockERC20Token,
  Shutdown,
} from "../typechain";
import { ethers } from "hardhat";
import * as chai from "chai";
import { deployTest, mock, probity } from "../lib/deployer";
import increaseTime from "./utils/increaseTime";
import { BigNumber } from "ethers";
import { ASSETS, bytes32, WAD, RAY, RAD } from "./utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let charlie: SignerWithAddress;
let don: SignerWithAddress;
let lender: SignerWithAddress;
let borrower: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vaultEngine: VaultEngine;
let registry: Registry;
let flrWallet: NativeToken;
let fxrpWallet: ERC20Token;
let teller: Teller;
let treasury: Treasury;
let ftsoFlr: MockFtso;
let ftsoFxrp: MockFtso;
let priceFeed: PriceFeed;
let auctioneerFlr: Auctioneer;
let auctioneerFxrp: Auctioneer;
let liquidator: Liquidator;
let reserve: ReservePool;
let erc20: MockERC20Token;
let shutdown: Shutdown;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function depositFxrp(user: SignerWithAddress, amount: BigNumber) {
  await erc20.mint(user.address, amount);
  await erc20.connect(user).approve(fxrpWallet.address, amount);
  await fxrpWallet.connect(user).deposit(amount);
}

async function expectBalancesToMatch(
  user: SignerWithAddress,
  balance: UserBalances[string]
) {
  if (balance["AUR"] !== undefined) {
    let stablecoin = await vaultEngine.stablecoin(user.address);

    expect(stablecoin).to.equal(balance["AUR"]);
  }

  if (balance["FLR"] !== undefined) {
    let vault = await vaultEngine.vaults(ASSETS["FLR"], user.address);

    if (balance["FLR"].collateral !== undefined) {
      expect(vault.collateral).to.equal(balance["FLR"].collateral);
    }

    if (balance["FLR"].debt !== undefined) {
      expect(vault.debt).to.equal(balance["FLR"].debt);
    }
    if (balance["FLR"].equity !== undefined) {
      expect(vault.equity).to.equal(balance["FLR"].equity);
    }
  }

  if (balance["FXRP"] !== undefined) {
    let vault = await vaultEngine.vaults(ASSETS["FXRP"], user.address);

    if (balance["FXRP"].collateral !== undefined) {
      expect(vault.collateral).to.equal(balance["FXRP"].collateral);
    }

    if (balance["FXRP"].debt !== undefined) {
      expect(vault.debt).to.equal(balance["FXRP"].debt);
    }
    if (balance["FXRP"].equity !== undefined) {
      expect(vault.equity).to.equal(balance["FXRP"].equity);
    }
  }
}

async function checkReserveBalances(reserveBalances: ReserveBalances) {
  expect(await vaultEngine.stablecoin(reserve.address)).to.equal(
    reserveBalances.reserve
  );
  expect(await vaultEngine.unbackedDebt(reserve.address)).to.equal(
    reserveBalances.debtToCover
  );
}

type VaultBalance = {
  underlying?: BigNumber;
  collateral?: BigNumber;
  debt?: BigNumber;
  equity?: BigNumber;
};

type UserBalances = {
  [key: string]: {
    AUR: BigNumber;
    FLR: VaultBalance;
    FXRP: VaultBalance;
  };
};

type ReserveBalances = {
  reserve: BigNumber;
  debtToCover: BigNumber;
};

describe("Shutdown Flow Test", function () {
  const TWO_DAYS_IN_SECONDS = 86400 * 2;
  const DEBT_THRESHOLD = RAD.mul(5000);
  let balances: UserBalances;
  let reserveBalances: ReserveBalances;

  beforeEach(async function () {
    let { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    flrWallet = contracts.nativeToken;
    fxrpWallet = contracts.erc20Token;
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    ftsoFlr = contracts.ftso;
    priceFeed = contracts.priceFeed;
    auctioneerFlr = contracts.auctioneer;
    liquidator = contracts.liquidator;
    reserve = contracts.reservePool;
    registry = contracts.registry;
    erc20 = contracts.mockErc20Token;
    shutdown = contracts.shutdown;

    contracts = await mock.deployMockFtso();
    ftsoFxrp = contracts.ftso;

    contracts = await probity.deployAuctioneer();
    auctioneerFxrp = contracts.auctioneer;

    owner = signers.owner;
    alice = signers.alice;
    bob = signers.bob;
    charlie = signers.charlie;
    don = signers.don;
    lender = signers.lender;
    borrower = signers.borrower;

    // Initialize FLR asset
    await vaultEngine.initAssetType(ASSETS["FLR"]);
    await vaultEngine.updateCeiling(ASSETS["FLR"], RAD.mul(10_000_000));
    await teller.initCollType(ASSETS["FLR"], 0);
    await priceFeed.init(ASSETS["FLR"], WAD.mul(15).div(10), ftsoFlr.address);
    await liquidator.init(ASSETS["FLR"], auctioneerFlr.address);

    // Initialize FXRP asset
    await vaultEngine.initAssetType(ASSETS["FXRP"]);
    await vaultEngine.updateCeiling(ASSETS["FXRP"], RAD.mul(10_000_000));
    await teller.initCollType(ASSETS["FXRP"], 0);
    await priceFeed.init(ASSETS["FXRP"], WAD.mul(15).div(10), ftsoFxrp.address);
    await liquidator.init(ASSETS["FXRP"], auctioneerFxrp.address);
    await reserve.updateDebtThreshold(DEBT_THRESHOLD);

    balances = {
      alice: { FLR: {}, FXRP: {}, AUR: WAD.mul(0) },
      bob: { FLR: {}, FXRP: {}, AUR: WAD.mul(0) },
      charlie: { FLR: {}, FXRP: {}, AUR: WAD.mul(0) },
      don: { FLR: {}, FXRP: {}, AUR: WAD.mul(0) },
      lender: { FLR: {}, FXRP: {}, AUR: WAD.mul(0) },
      borrower: { FLR: {}, FXRP: {}, AUR: WAD.mul(0) },
    };
    reserveBalances = { reserve: WAD.mul(0), debtToCover: WAD.mul(0) };

    await registry.setupAddress(bytes32("whitelisted"), alice.address);
    await registry.setupAddress(bytes32("whitelisted"), bob.address);
    await registry.setupAddress(bytes32("whitelisted"), charlie.address);
    await registry.setupAddress(bytes32("whitelisted"), don.address);
    await registry.setupAddress(bytes32("whitelisted"), lender.address);
    await registry.setupAddress(bytes32("whitelisted"), borrower.address);
  });

  it("should shutdown when the system is solvent", async () => {
    // Set FLR = $1.10
    await ftsoFlr.setCurrentPrice(RAY.mul(11).div(10));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);

    // Set FXRP = $2.78
    await ftsoFxrp.setCurrentPrice(RAY.mul(278).div(100));
    await priceFeed.updateAdjustedPrice(ASSETS["FXRP"]);

    /**
     * Set up 4 users with 3 unhealthy vaults
     */

    let expectedTotalDebt = BigNumber.from(0); // rad
    let underlying: BigNumber; // wad
    let equity: BigNumber; // wad
    let collateral: BigNumber; // wad
    let debt: BigNumber; // wad

    // Alice utilizes 2300 FLR ($2530) to MINT 1000 AUR
    (underlying = WAD.mul(2300)), (equity = WAD.mul(1000));
    await flrWallet.connect(alice).deposit({ value: underlying });
    await vaultEngine
      .connect(alice)
      .modifyEquity(ASSETS["FLR"], treasury.address, underlying, equity);
    balances.alice["FLR"] = { underlying, equity };

    // Alice utilizes 1,000,000 FXRP ($2,780,000) to MINT 300,000 AUR
    (underlying = WAD.mul(1_000_000)), (equity = WAD.mul(300_000));
    await depositFxrp(alice, underlying);
    await vaultEngine
      .connect(alice)
      .modifyEquity(ASSETS["FXRP"], treasury.address, underlying, equity);
    balances.alice["FXRP"] = { underlying, equity };
    await expectBalancesToMatch(alice, balances.alice);

    // Bob utilizes 2300 FLR ($2530) to BORROW 1500 AUR
    (collateral = WAD.mul(2300)), (debt = WAD.mul(1500));
    await flrWallet.connect(bob).deposit({ value: collateral });
    await vaultEngine
      .connect(bob)
      .modifyDebt(ASSETS["FLR"], treasury.address, collateral, debt);
    balances.bob["FLR"] = { collateral, debt };
    balances.bob["AUR"] = RAY.mul(debt);
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    await expectBalancesToMatch(bob, balances.bob);

    // Bob utilizes 150,000 FXRP ($417,000) to BORROW 135,000 AUR
    (collateral = WAD.mul(150_000)), (debt = WAD.mul(135_000));
    await depositFxrp(bob, collateral);
    await vaultEngine
      .connect(bob)
      .modifyDebt(ASSETS["FXRP"], treasury.address, collateral, debt);
    balances.bob["FXRP"] = { collateral, debt };
    balances.bob["AUR"] = balances.bob["AUR"].add(debt.mul(RAY));
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    await expectBalancesToMatch(bob, balances.bob);

    // Charlie utilizes 400,000 FXRP ($1,112,000) to MINT 150,000 AUR
    (underlying = WAD.mul(400_000)), (equity = WAD.mul(150_000));
    await depositFxrp(charlie, underlying);
    await vaultEngine
      .connect(charlie)
      .modifyEquity(ASSETS["FXRP"], treasury.address, underlying, equity);
    balances.charlie["FXRP"] = { underlying, equity };
    await expectBalancesToMatch(charlie, balances.charlie);

    // Charlie utilizes 200,000 FXRP ($556,000) to BORROW 150,000 AUR
    (collateral = WAD.mul(200_000)), (debt = WAD.mul(150_000));
    await depositFxrp(charlie, collateral);
    await vaultEngine
      .connect(charlie)
      .modifyDebt(ASSETS["FXRP"], treasury.address, collateral, debt);
    balances.charlie["FXRP"] = { collateral, debt };
    balances.charlie["AUR"] = debt.mul(RAY);
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    await expectBalancesToMatch(charlie, balances.charlie);

    // Don utilizes 6900 FLR ($7590) to BORROW 4500 AUR
    (collateral = WAD.mul(6900)), (debt = WAD.mul(4500));
    await flrWallet.connect(don).deposit({ value: collateral });
    await vaultEngine
      .connect(don)
      .modifyDebt(ASSETS["FLR"], treasury.address, collateral, debt);
    balances.don["FLR"] = { collateral, debt };
    balances.don["AUR"] = RAY.mul(debt);
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    await expectBalancesToMatch(don, balances.don);

    // Total debt should be 291,000 AUR
    expect(await vaultEngine.totalDebt()).to.equal(expectedTotalDebt);

    // Drop prices (FLR: $1.10 => $0.60), FXRP: ($2.78 => $1.23)
    await ftsoFlr.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(60).div(100));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);
    await ftsoFxrp.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(123).div(100));
    await priceFeed.updateAdjustedPrice(ASSETS["FXRP"]);

    /**
     * Start 2 auctions, 1 of each collateral (FLR, FXRP).
     */

    // Liquidate Bob's FLR vault ($1380 backing 1500 AUR)
    await liquidator.liquidateVault(ASSETS["FLR"], bob.address);
    let newDebtToCover = balances.bob["FLR"].debt.mul(RAY);
    reserveBalances.debtToCover = newDebtToCover;
    await checkReserveBalances(reserveBalances);

    // Liquidate Bob's FXRP vault ($184,500 backing 135,000 AUR)
    await liquidator.liquidateVault(ASSETS["FXRP"], bob.address);
    newDebtToCover = balances.bob["FXRP"].debt.mul(RAY);
    reserveBalances.debtToCover =
      reserveBalances.debtToCover.add(newDebtToCover);
    await checkReserveBalances(reserveBalances);

    // Update expected balances
    (collateral = WAD.mul(0)), (debt = WAD.mul(0));
    balances.bob["FLR"] = { collateral, debt };
    balances.bob["FXRP"] = { collateral, debt };
    await expectBalancesToMatch(bob, balances.bob);

    /**
     * Increase unbacked system debt and start IOU sale
     */

    // CHECKPOINT

    // Increase by 5000 * 1.2 = 6000
    await reserve.increaseSystemDebt(DEBT_THRESHOLD.mul(12).div(10));
    reserveBalances.reserve = DEBT_THRESHOLD.mul(12).div(10);
    reserveBalances.debtToCover = reserveBalances.debtToCover.add(
      DEBT_THRESHOLD.mul(12).div(10)
    );
    await checkReserveBalances(reserveBalances);

    // Send all reserve stablecoins to Bob's (proxy for pool diminishment)
    await reserve.sendStablecoin(bob.address, DEBT_THRESHOLD.mul(12).div(10));
    reserveBalances.reserve = RAD.mul(0);
    await checkReserveBalances(reserveBalances);

    balances.bob["AUR"] = balances.bob["AUR"].add(
      DEBT_THRESHOLD.mul(12).div(10)
    );
    await expectBalancesToMatch(bob, balances.bob);

    // Charlie purchases 5000 * 0.75 = 3750 vouchers
    await reserve.startSale();
    await reserve
      .connect(charlie)
      .purchaseVouchers(DEBT_THRESHOLD.mul(3).div(4));
    reserveBalances.debtToCover = reserveBalances.debtToCover.sub(
      DEBT_THRESHOLD.mul(3).div(4)
    );
    await checkReserveBalances(reserveBalances);

    balances.charlie["AUR"] = balances.charlie["AUR"].sub(
      DEBT_THRESHOLD.mul(3).div(4)
    );
    await expectBalancesToMatch(charlie, balances.charlie);

    // User 2 purchases 5000 * 0.25 = 1250 vouchers; all bad debt has been covered
    await reserve.connect(bob).purchaseVouchers(DEBT_THRESHOLD.div(4));
    reserveBalances.debtToCover = reserveBalances.debtToCover.sub(
      DEBT_THRESHOLD.div(4)
    );
    await checkReserveBalances(reserveBalances);

    balances.bob["AUR"] = balances.bob["AUR"].sub(DEBT_THRESHOLD.div(4));
    await expectBalancesToMatch(bob, balances.bob);

    /**
     * Replenish system reserves (enough to cover all bad debt, with extra left over)
     */

    // User 2 (proxy for protocol replenishment) transfers 7000 AUR to the reserve pool
    await treasury
      .connect(bob)
      .transferStablecoin(reserve.address, WAD.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(7000));
    await checkReserveBalances(reserveBalances);
    balances.bob["AUR"] = balances.bob["AUR"].sub(RAD.mul(7000));
    await expectBalancesToMatch(bob, balances.bob);

    // Charlie transfers 140_000 AUR to the reserve pool
    await treasury
      .connect(charlie)
      .transferStablecoin(reserve.address, WAD.mul(140_000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(140_000));
    await checkReserveBalances(reserveBalances);
    balances.charlie["AUR"] = balances.charlie["AUR"].sub(RAD.mul(140_000));
    await expectBalancesToMatch(charlie, balances.charlie);

    /**
     * Shutdown
     */

    // Initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);

    // drop prices flr: ($60 => $0.42), fxrp: ($1.23 => $1.03)
    await ftsoFlr.setCurrentPrice(RAY.mul(42).div(100));
    await ftsoFxrp.setCurrentPrice(RAY.mul(103).div(100));

    // set final prices
    await shutdown.setFinalPrice(ASSETS["FLR"]);
    expect((await shutdown.assets(ASSETS["FLR"])).finalPrice).to.equal(
      RAY.mul(42).div(100)
    );
    await shutdown.setFinalPrice(ASSETS["FXRP"]);
    expect((await shutdown.assets(ASSETS["FXRP"])).finalPrice).to.equal(
      RAY.mul(103).div(100)
    );

    // Process debt for FLR vaults
    // NOTE: gap shouldn't change for user 1 since they never borrowed
    await shutdown.processUserDebt(ASSETS["FLR"], alice.address);

    let EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(ASSETS["FLR"])).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // gap shouldn't change for Bob's since their collateral is on auction
    await shutdown.processUserDebt(ASSETS["FLR"], bob.address);

    EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(ASSETS["FLR"])).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // gap should still be zero because user 3 doesn't have a FLR vault
    await shutdown.processUserDebt(ASSETS["FLR"], charlie.address);

    EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(ASSETS["FLR"])).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // Don owed 4500 AUR; value of coll: 69_000 FLR * $0.42 per collateral unit = $2898
    // AUR gap should be 1602 and coll.gap should be 3814.28571429
    await shutdown.processUserDebt(ASSETS["FLR"], don.address);

    EXPECTED_FLR_GAP = "3814285714285714285714";
    let EXPECTED_AUR_GAP = RAD.mul(1602);

    expect((await shutdown.assets(ASSETS["FLR"])).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    expect(
      (await shutdown.unbackedDebt()).sub(EXPECTED_AUR_GAP).abs().lte(RAD)
    ).to.equal(true);

    // Process debt for FXRP collateral
    await shutdown.processUserDebt(ASSETS["FXRP"], alice.address);
    await shutdown.processUserDebt(ASSETS["FXRP"], bob.address);
    await shutdown.processUserDebt(ASSETS["FXRP"], charlie.address);
    await shutdown.processUserDebt(ASSETS["FXRP"], don.address);

    const EXPECTED_FXRP_GAP = 0;

    expect((await shutdown.assets(ASSETS["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    // Increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to pay off system debt
    await reserve.settle(RAD.mul(137_500));
    reserveBalances.reserve = reserveBalances.reserve.sub(RAD.mul(137_500));
    reserveBalances.debtToCover = reserveBalances.debtToCover.sub(
      RAD.mul(137_500)
    );
    await checkReserveBalances(reserveBalances);

    await shutdown.writeOffFromReserves();
    reserveBalances.reserve = reserveBalances.reserve.sub(RAD.mul(137_500));

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();
    const EXPECTED_FINAL_DEBT_BALANCE = RAD.mul(154_500);

    await shutdown.calculateInvestorObligation();

    const EXPECTED_SUPPLIER_OBLIGATION_RATIO = 0;

    expect(await shutdown.investorObligationRatio()).to.equal(
      EXPECTED_SUPPLIER_OBLIGATION_RATIO
    );

    // Increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    expect(await shutdown.finalDebtBalance()).to.equal(
      EXPECTED_FINAL_DEBT_BALANCE
    );

    // calcuate redemption ratio
    await shutdown.calculateRedemptionRatio(ASSETS["FLR"]);
    // redeemption ratio = theoretical max - gap / total["AUR"] in circulation
    // 10714285714285714285714 - 3814285714285714285714 (6900000000000000000000) / $154500
    // 6900 / $154500 = 0.0446601941

    const EXPECTED_FLR_REDEMPTION_RATIO = "44660194174757281553398058";
    expect((await shutdown.assets(ASSETS["FLR"])).redemptionRatio).to.equal(
      EXPECTED_FLR_REDEMPTION_RATIO
    );

    await shutdown.calculateRedemptionRatio(ASSETS["FXRP"]);
    // redemption ratio = theoretical max - gap / total["AUR"] in circulation
    // 150000 / $1.03 / $154500 = 0.9425959091
    const EXPECTED_FXRP_REDEMPTION_RATIO = "942595909133754359506077669";
    expect((await shutdown.assets(ASSETS["FXRP"])).redemptionRatio).to.equal(
      EXPECTED_FXRP_REDEMPTION_RATIO
    );

    // return["AUR"]
    await shutdown.connect(bob).returnStablecoin(RAD.mul(65000 + 1500));
    expect(await shutdown["AUR"](bob.address)).to.equal(RAD.mul(65000 + 1500));

    // redeem collateral
    let before = (await vaultEngine.vaults(ASSETS["FLR"], bob.address)).standby;
    await shutdown.connect(bob).redeemCollateral(ASSETS["FLR"]);
    let after = (await vaultEngine.vaults(ASSETS["FLR"], bob.address)).standby;
    // redemption ratio *["AUR"] returned
    // 0.0446601941 * 66500 = 2969.90290765
    const EXPECTED_FLR_COLL_REDEEMED = WAD.mul(296990290765).div(1e8);
    // we are okay with up to 0.001 collateral difference
    expect(
      after.sub(before).sub(EXPECTED_FLR_COLL_REDEEMED).lte(WAD.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(ASSETS["FXRP"], bob.address)).standby;
    await shutdown.connect(bob).redeemCollateral(ASSETS["FXRP"]);
    after = (await vaultEngine.vaults(ASSETS["FXRP"], bob.address)).standby;

    // redemption ratio *["AUR"] returned
    // 0.9425959091 * 66500 = 62682.6279552
    const EXPECTED_FXRP_COLL_REDEEMED = WAD.mul("626826279552").div(1e7);
    // we are okay with up to 0.001 collateral difference
    expect(
      after.sub(before).sub(EXPECTED_FXRP_COLL_REDEEMED).lte(WAD.div(100))
    ).to.equal(true);

    // set finalSystemReserve
    await shutdown.setFinalSystemReserve();
    const EXPECTED_FINAL_TOTAL_RESERVE = RAD.mul(7898);
    expect(
      (await shutdown.finalTotalReserve())
        .sub(EXPECTED_FINAL_TOTAL_RESERVE)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);

    before = await reserve.vouchers(bob.address);
    await shutdown.connect(bob).redeemVouchers();
    after = await reserve.vouchers(bob.address);
    const EXPECTED_IOU_BALANCE_CHANGE = DEBT_THRESHOLD.div(4);
    expect(before.sub(after)).to.equal(EXPECTED_IOU_BALANCE_CHANGE);
  });

  it("test happy flow where system is insolvent", async () => {
    // set up scenario for insolvent system

    // current collateral ratio: 150%
    // starting price flr: $4.30, fxrp: $6.23
    await ftsoFlr.setCurrentPrice(RAY.mul(43).div(10));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);
    await ftsoFxrp.setCurrentPrice(RAY.mul(623).div(100));
    await priceFeed.updateAdjustedPrice(ASSETS["FXRP"]);

    // have at least 4 vault that is undercollateralized
    await flrWallet
      .connect(alice)
      .deposit({ value: ethers.utils.parseEther("4500") });
    await depositFxrp(alice, WAD.mul(1000000));
    await vaultEngine
      .connect(alice)
      .modifyEquity(
        ASSETS["FLR"],
        treasury.address,
        WAD.mul(4500),
        WAD.mul(5000)
      );
    balances.alice["FLR"] = {
      underlying: WAD.mul(4500),
      equity: WAD.mul(5000),
    };

    await vaultEngine
      .connect(alice)
      .modifyEquity(
        ASSETS["FXRP"],
        treasury.address,
        WAD.mul(1000000),
        WAD.mul(2000000)
      );
    balances.alice["FXRP"] = {
      underlying: WAD.mul(1000000),
      equity: WAD.mul(2000000),
    };
    await expectBalancesToMatch(alice, balances.alice);

    await flrWallet
      .connect(bob)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await depositFxrp(bob, WAD.mul(270000));
    await vaultEngine
      .connect(bob)
      .modifyDebt(
        ASSETS["FLR"],
        treasury.address,
        WAD.mul(2300),
        WAD.mul(6000)
      );
    balances.bob["FLR"] = {
      collateral: WAD.mul(2300),
      debt: WAD.mul(6000),
    };
    await vaultEngine
      .connect(bob)
      .modifyDebt(
        ASSETS["FXRP"],
        treasury.address,
        WAD.mul(270_000),
        WAD.mul(1_100_000)
      );
    balances.bob["FXRP"] = {
      collateral: WAD.mul(270_000),
      debt: WAD.mul(1_100_000),
    };
    balances.bob["AUR"] = RAD.mul(6000 + 1_100_000);
    await expectBalancesToMatch(bob, balances.bob);

    await flrWallet
      .connect(charlie)
      .deposit({ value: ethers.utils.parseEther("9000") });
    await vaultEngine
      .connect(charlie)
      .modifyDebt(
        ASSETS["FLR"],
        treasury.address,
        WAD.mul(9000),
        WAD.mul(15_000)
      );
    await vaultEngine
      .connect(charlie)
      .modifyDebt(ASSETS["FLR"], treasury.address, WAD.mul(0), WAD.mul(10_000));

    balances.charlie["FLR"] = {
      collateral: WAD.mul(9000),
      debt: WAD.mul(10_000 + 15_000),
    };
    balances.charlie["AUR"] = RAD.mul(15_000 + 10_000);
    await expectBalancesToMatch(charlie, balances.charlie);

    await depositFxrp(don, WAD.mul(620_000));
    await vaultEngine
      .connect(don)
      .modifyEquity(
        ASSETS["FXRP"],
        treasury.address,
        WAD.mul(400_000),
        WAD.mul(1_000_000)
      );
    await vaultEngine
      .connect(don)
      .modifyDebt(
        ASSETS["FXRP"],
        treasury.address,
        WAD.mul(220_000),
        WAD.mul(1_500_000)
      );

    balances.don["FXRP"] = {
      underlying: WAD.mul(400_000),
      collateral: WAD.mul(220_000),
      debt: WAD.mul(1_500_000),
      equity: WAD.mul(1_000_000),
    };
    balances.don["AUR"] = RAD.mul(1_500_000);
    await expectBalancesToMatch(don, balances.don);

    await flrWallet
      .connect(lender)
      .deposit({ value: ethers.utils.parseEther("2000") });
    await depositFxrp(lender, WAD.mul(1_830_000));
    await vaultEngine
      .connect(lender)
      .modifyEquity(
        ASSETS["FLR"],
        treasury.address,
        WAD.mul(1000),
        WAD.mul(1500)
      );
    await vaultEngine
      .connect(lender)
      .modifyDebt(
        ASSETS["FLR"],
        treasury.address,
        WAD.mul(1000),
        WAD.mul(1500)
      );

    balances.lender["FLR"] = {
      underlying: WAD.mul(1000),
      collateral: WAD.mul(1000),
      debt: WAD.mul(1500),
      equity: WAD.mul(1500),
    };

    await vaultEngine
      .connect(lender)
      .modifyEquity(
        ASSETS["FXRP"],
        treasury.address,
        WAD.mul(1_830_000),
        WAD.mul(1_500_000)
      );
    await vaultEngine
      .connect(lender)
      .modifyDebt(
        ASSETS["FXRP"],
        treasury.address,
        WAD.mul(0),
        WAD.mul(1_200_000)
      );

    balances.lender["FXRP"] = {
      underlying: WAD.mul(1_830_000),
      debt: WAD.mul(1_200_000),
      equity: WAD.mul(1_500_000),
    };
    balances.lender["AUR"] = RAD.mul(1_200_000 + 1500);
    await expectBalancesToMatch(lender, balances.lender);

    // new collateral ratio: 175%
    // drop prices flr: $3.60, fxrp: $4.48
    await priceFeed.updateLiquidationRatio(
      ASSETS["FLR"],
      WAD.mul(175).div(100)
    );
    await priceFeed.updateLiquidationRatio(
      ASSETS["FXRP"],
      WAD.mul(175).div(100)
    );
    await ftsoFlr.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(360).div(100));
    await priceFeed.updateAdjustedPrice(ASSETS["FLR"]);
    await ftsoFxrp.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(448).div(100));
    await priceFeed.updateAdjustedPrice(ASSETS["FXRP"]);

    // start 2 auction 1 of each collateral

    await liquidator.liquidateVault(ASSETS["FLR"], bob.address);
    balances.bob["FLR"] = {
      collateral: WAD.mul(0),
      debt: WAD.mul(0),
    };
    reserveBalances.debtToCover = RAD.mul(6000);
    await checkReserveBalances(reserveBalances);

    await liquidator.liquidateVault(ASSETS["FXRP"], bob.address);
    balances.bob["FXRP"] = {
      collateral: WAD.mul(0),
      debt: WAD.mul(0),
    };
    reserveBalances.debtToCover = reserveBalances.debtToCover.add(
      RAD.mul(1_100_000)
    );
    await checkReserveBalances(reserveBalances);

    // put system reserve to fill up some gap but not entirely
    await treasury
      .connect(bob)
      .transferStablecoin(reserve.address, WAD.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(7000));
    await checkReserveBalances(reserveBalances);
    balances.bob["AUR"] = balances.bob["AUR"].sub(RAD.mul(7000));
    await expectBalancesToMatch(bob, balances.bob);

    await treasury
      .connect(don)
      .transferStablecoin(reserve.address, WAD.mul(140_000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(140_000));
    await checkReserveBalances(reserveBalances);
    balances.don["AUR"] = balances.don["AUR"].sub(RAD.mul(140_000));
    await expectBalancesToMatch(don, balances.don);

    // initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);

    // drop prices flr: $2.23, fxrp: $2.20
    await ftsoFlr.setCurrentPrice(RAY.mul(223).div(100));
    await ftsoFxrp.setCurrentPrice(RAY.mul(220).div(100));

    // set final prices
    await shutdown.setFinalPrice(ASSETS["FLR"]);
    expect((await shutdown.assets(ASSETS["FLR"])).finalPrice).to.equal(
      RAY.mul(223).div(100)
    );
    await shutdown.setFinalPrice(ASSETS["FXRP"]);
    expect((await shutdown.assets(ASSETS["FXRP"])).finalPrice).to.equal(
      RAY.mul(220).div(100)
    );

    // process debt for flr collateral
    await shutdown.processUserDebt(ASSETS["FLR"], alice.address);
    let EXPECTED_FLR_GAP = WAD.mul(0);
    expect((await shutdown.assets(ASSETS["FLR"])).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    await shutdown.processUserDebt(ASSETS["FLR"], bob.address);
    expect((await shutdown.assets(ASSETS["FLR"])).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    await shutdown.processUserDebt(ASSETS["FLR"], charlie.address);

    // user 3 have debt of $25000 and have 9000 flr coll @ 2.23 = $20070
    // unbackedDebt should be 25000 - 20070 = 4930
    // collGap should be 4930 / 2.23 = 2210.76233184
    EXPECTED_FLR_GAP = WAD.mul("221076233184").div(1e8);
    let EXPECTED_AUR_GAP = RAD.mul(4930);
    expect(
      (await shutdown.unbackedDebt())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    await shutdown.processUserDebt(ASSETS["FLR"], don.address);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(ASSETS["FLR"], lender.address);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // process debt for fxrp collateral
    await shutdown.processUserDebt(ASSETS["FXRP"], alice.address);
    let EXPECTED_FXRP_GAP = WAD.mul(0);
    expect((await shutdown.assets(ASSETS["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(ASSETS["FXRP"], bob.address);
    expect((await shutdown.assets(ASSETS["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(ASSETS["FXRP"], charlie.address);
    expect((await shutdown.assets(ASSETS["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(ASSETS["FXRP"], don.address);
    // user 4 have debt of $1500000, coll value: 620000 * 2.20 = 1364000
    // unbackedDebt should be 1500000 - 1364000 = 136000
    // collGap should be 136000 / 2.20 = 61818.1818182
    EXPECTED_FXRP_GAP = WAD.mul("618181818182").div(1e7);
    EXPECTED_AUR_GAP = EXPECTED_AUR_GAP.add(RAD.mul(136_000));
    expect(
      (await shutdown.unbackedDebt())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(ASSETS["FXRP"], lender.address);

    expect(
      (await shutdown.unbackedDebt())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to settle system debt
    await reserve.settle(RAD.mul(147_000));

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();
    const EXPECTED_FINAL_DEBT_BALANCE = RAD.mul(3_685_500);
    expect(await shutdown.finalDebtBalance()).to.equal(
      EXPECTED_FINAL_DEBT_BALANCE
    );

    await shutdown.calculateInvestorObligation();

    // total unbackedDebt 140930
    // total equity * final utilization Ratio = total equity in use
    // $4506500 * 0.85043825585 = 3832500
    // total unbackedDebt / total equity in use = supplier obligation ratio
    // 140930 / 3685500 = 0.0382390449

    const EXPECTED_SUPPLIER_OBLIGATION_RATIO = WAD.mul("382390449").div(1e10);
    expect(
      (await shutdown.investorObligationRatio())
        .sub(EXPECTED_SUPPLIER_OBLIGATION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    // process supplier for flr collateral
    await shutdown.processUserEquity(ASSETS["FLR"], alice.address);
    // user 1 has supplied $5000, 0.85043825585 = 4252.19127925 on hook
    // supplied amount * supplier obligation ratio
    // 4252.19127925  * 0.0382390449 = 162.599733251
    // coll amount = 162.599733251 / 2.23 = 72.9146785877
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(WAD.mul("729146785877").div(1e10));
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSETS["FLR"], bob.address);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    await shutdown.processUserEquity(ASSETS["FLR"], charlie.address);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSETS["FLR"], don.address);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSETS["FLR"], lender.address);

    // lender supplied $1500 * 0.85043825585 = 1275.65738377
    // 1275.65738377 * 0.0382390449 = 48.779919975
    // 48.779919975 / 2.23 = 21.8744035762
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(WAD.mul("218744035762").div(1e10));

    expect(
      (await shutdown.assets(ASSETS["FLR"])).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // process supplier for fxrp collateral
    await shutdown.processUserEquity(ASSETS["FXRP"], alice.address);
    // alice supplied $2000000 * 0.85043825585 = 1700876.5117
    // 1700876.5117 * 0.0382390449 = 65039.8933003
    // 65039.8933003 / 2.20 = 29563.5878638
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(WAD.mul("295635878638").div(1e7));
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSETS["FXRP"], bob.address);
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSETS["FXRP"], charlie.address);
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSETS["FXRP"], don.address);
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // lender supplied $1500000 * 0.85043825585 = 1275657.38377
    // 1275657.38377 * 0.0382390449 = 48779.919975
    // 48779.919975 / 2.20 = 22172.6908977
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(WAD.mul("221726908977").div(1e7));

    await shutdown.processUserEquity(ASSETS["FXRP"], lender.address);
    expect(
      (await shutdown.assets(ASSETS["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // calcuate redemption ratio
    await shutdown.calculateRedemptionRatio(ASSETS["FLR"]);
    // redemption ratio = theoretical max - gap / total["AUR"] in circulation
    // ((26500 / $2.23) - 2115.9732496600 / $3685500
    // 11883.4080717 - 2063.5106908794 = 9767.43482209
    // 9767.43482209 / 3685500 = 0.00265023329

    const EXPECTED_FLR_REDEMPTION_RATIO = RAY.mul("265023329").div(1e11);
    expect(
      (await shutdown.assets(ASSETS["FLR"])).redemptionRatio
        .sub(EXPECTED_FLR_REDEMPTION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    await shutdown.calculateRedemptionRatio(ASSETS["FXRP"]);
    // redemption ratio = theoretical max - gap / total["AUR"] in circulation
    // ((2700000 / $2.20) - 10081.9030487 / $3685500
    // 1227272.72727 - 10081.9030487 = 1217190.82422
    // 1217190.82422 / $3685500 = 0.3302647739
    const EXPECTED_FXRP_REDEMPTION_RATIO = RAY.mul("3302647739").div(1e10);

    expect(
      (await shutdown.assets(ASSETS["FXRP"])).redemptionRatio
        .sub(EXPECTED_FXRP_REDEMPTION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // return["AUR"]
    await shutdown.connect(bob).returnStablecoin(RAD.mul(1_099_000));
    expect(await shutdown["AUR"](bob.address)).to.equal(RAD.mul(1_099_000));

    // redeem collateral
    let before = (await vaultEngine.vaults(ASSETS["FLR"], bob.address)).standby;
    await shutdown.connect(bob).redeemCollateral(ASSETS["FLR"]);
    let after = (await vaultEngine.vaults(ASSETS["FLR"], bob.address)).standby;
    // bob["AUR"] balance: 1099000
    //["AUR"] balance * flr Redeemed Collateral
    // 1099000 * 0.00265023329 = 2912.60638571
    const EXPECTED_FLR_COLL_REDEEMED = WAD.mul("291260638571").div(1e8);
    expect(
      after.sub(before).sub(EXPECTED_FLR_COLL_REDEEMED).abs().lte(WAD.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(ASSETS["FXRP"], bob.address)).standby;
    await shutdown.connect(bob).redeemCollateral(ASSETS["FXRP"]);
    after = (await vaultEngine.vaults(ASSETS["FXRP"], bob.address)).standby;
    // bob["AUR"] balance: 1099000
    //["AUR"] balance * flr Redeemed Collateral
    // 1099000 * 0.3302647739 = 362960.986516
    const EXPECTED_FXRP_COLL_REDEEMED = WAD.mul("362960986516").div(1e6);
    expect(
      after.sub(before).sub(EXPECTED_FXRP_COLL_REDEEMED).abs().lte(WAD.div(100))
    ).to.equal(true);
  });
});
