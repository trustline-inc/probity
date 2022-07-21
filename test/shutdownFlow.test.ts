import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import {
  USD,
  VaultEngine,
  NativeAssetManager,
  Teller,
  Treasury,
  MockFtso,
  PriceFeed,
  Auctioneer,
  Liquidator,
  ReservePool,
  Registry,
  MockErc20AssetManager,
  MockErc20Token,
  Shutdown,
  BondIssuer,
} from "../typechain";
import { ethers } from "hardhat";
import * as chai from "chai";
import { deployTest, mock, probity } from "../lib/deployer";
import increaseTime from "./utils/increaseTime";
import { BigNumber } from "ethers";
import { ASSET_ID, bytes32, WAD, RAY, RAD } from "./utils/constants";
import * as exp from "constants";
import { wdiv } from "./utils/math";
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
let usd: USD;
let vaultEngine: VaultEngine;
let registry: Registry;
let flrWallet: NativeAssetManager;
let fxrpWallet: MockErc20AssetManager;
let teller: Teller;
let treasury: Treasury;
let ftsoFlr: MockFtso;
let ftsoFxrp: MockFtso;
let priceFeed: PriceFeed;
let auctioneerFlr: Auctioneer;
let auctioneerFxrp: Auctioneer;
let liquidator: Liquidator;
let reserve: ReservePool;
let erc20: MockErc20Token;
let shutdown: Shutdown;
let bondIssuer: BondIssuer;

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
  if (balance["USD"] !== undefined) {
    let stablecoin = await vaultEngine.systemCurrency(user.address);

    expect(stablecoin).to.equal(balance["USD"]);
  }

  if (balance["FLR"] !== undefined) {
    let vault = await vaultEngine.vaults(ASSET_ID.FLR, user.address);

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
    let vault = await vaultEngine.vaults(ASSET_ID["FXRP"], user.address);

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
  expect(await vaultEngine.systemCurrency(reserve.address)).to.equal(
    reserveBalances.reserve
  );
  expect(await vaultEngine.systemDebt(reserve.address)).to.equal(
    reserveBalances.debtToCover
  );
}

type VaultBalance = {
  underlying?: BigNumber;
  collateral?: BigNumber;
  debt?: BigNumber;
  equity?: BigNumber;
};

type UserBalance = {
  USD: BigNumber;
  FLR: VaultBalance;
  FXRP: VaultBalance;
};

type UserBalances = {
  [key: string]: UserBalance;
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
    vaultEngine = contracts.vaultEngine!;
    flrWallet = contracts.nativeAssetManager!;
    fxrpWallet = contracts.mockErc20AssetManager!;
    usd = contracts.usd!;
    teller = contracts.teller!;
    treasury = contracts.treasury!;
    ftsoFlr = contracts.ftso!;
    priceFeed = contracts.priceFeed!;
    auctioneerFlr = contracts.auctioneer!;
    liquidator = contracts.liquidator!;
    reserve = contracts.reservePool!;
    registry = contracts.registry!;
    erc20 = contracts.mockErc20Token!;
    shutdown = contracts.shutdown!;
    bondIssuer = contracts.bondIssuer!;

    contracts = (await mock.deployMockFtso()) as any;
    ftsoFxrp = contracts.ftso!;

    contracts = await probity.deployAuctioneer();
    auctioneerFxrp = contracts.auctioneer!;

    owner = signers.owner!;
    alice = signers.alice!;
    bob = signers.bob!;
    charlie = signers.charlie!;
    don = signers.don!;
    lender = signers.lender!;
    borrower = signers.borrower!;

    // Initialize FLR asset
    await vaultEngine.initAsset(ASSET_ID.FLR, 2);
    await vaultEngine.updateCeiling(ASSET_ID.FLR, RAD.mul(10_000_000));
    await teller.initAsset(ASSET_ID.FLR, 0);
    await priceFeed.initAsset(
      ASSET_ID.FLR,
      WAD.mul(15).div(10),
      ftsoFlr.address
    );
    await liquidator.initAsset(ASSET_ID.FLR, auctioneerFlr.address);

    // Initialize FXRP asset
    await vaultEngine.initAsset(ASSET_ID["FXRP"], 2);
    await vaultEngine.updateCeiling(ASSET_ID["FXRP"], RAD.mul(10_000_000));
    await teller.initAsset(ASSET_ID["FXRP"], 0);
    await priceFeed.initAsset(
      ASSET_ID["FXRP"],
      WAD.mul(15).div(10),
      ftsoFxrp.address
    );
    await liquidator.initAsset(ASSET_ID["FXRP"], auctioneerFxrp.address);
    await reserve.updateDebtThreshold(DEBT_THRESHOLD);

    const initUserBalance: () => UserBalance = () => {
      return {
        FLR: {
          debt: BigNumber.from(0),
        },
        FXRP: {
          debt: BigNumber.from(0),
        },
        USD: WAD.mul(0),
      };
    };

    balances = {
      alice: initUserBalance(),
      bob: initUserBalance(),
      charlie: initUserBalance(),
      don: initUserBalance(),
      lender: initUserBalance(),
      borrower: initUserBalance(),
    };
    reserveBalances = { reserve: WAD.mul(0), debtToCover: WAD.mul(0) };

    await registry.setupAddress(bytes32("whitelisted"), alice.address, false);
    await registry.setupAddress(bytes32("whitelisted"), bob.address, false);
    await registry.setupAddress(bytes32("whitelisted"), charlie.address, false);
    await registry.setupAddress(bytes32("whitelisted"), don.address, false);
    await registry.setupAddress(bytes32("whitelisted"), lender.address, false);
    await registry.setupAddress(
      bytes32("whitelisted"),
      borrower.address,
      false
    );
    await registry.setupAddress(
      bytes32("assetManager"),
      fxrpWallet.address,
      true
    );
    await fxrpWallet.setVaultEngine(vaultEngine.address);
  });

  it("should shutdown when the system is solvent", async () => {
    // Set FLR = $1.10
    await ftsoFlr.setCurrentPrice(RAY.mul(11).div(10));
    await priceFeed.updateAdjustedPrice(ASSET_ID.FLR);

    // Set FXRP = $2.78
    await ftsoFxrp.setCurrentPrice(RAY.mul(278).div(100));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FXRP"]);

    /**
     * Set up 4 users with 3 unhealthy vaults
     */

    let expectedTotalDebt = BigNumber.from(0); // rad
    let expectedTotalStablecoin = BigNumber.from(0); // rad
    let underlying: BigNumber; // wad
    let equity: BigNumber; // wad
    let collateral: BigNumber; // wad
    let debt: BigNumber; // wad

    // Alice utilizes 2300 FLR ($2530) to MINT 1000 USD
    (underlying = WAD.mul(2300)), (equity = WAD.mul(1000));
    await flrWallet.connect(alice).deposit({ value: underlying });
    await vaultEngine
      .connect(alice)
      .modifyEquity(ASSET_ID.FLR, treasury.address, underlying, equity);
    balances.alice["FLR"] = { underlying, equity };

    // Alice utilizes 1,000,000 FXRP ($2,780,000) to MINT 300,000 USD
    (underlying = WAD.mul(1_000_000)), (equity = WAD.mul(300_000));
    await depositFxrp(alice, underlying);
    await vaultEngine
      .connect(alice)
      .modifyEquity(ASSET_ID["FXRP"], treasury.address, underlying, equity);
    balances.alice["FXRP"] = { underlying, equity };
    await expectBalancesToMatch(alice, balances.alice);

    // Bob utilizes 2300 FLR ($2530) to BORROW 1500 USD
    (collateral = WAD.mul(2300)), (debt = WAD.mul(1500));
    await flrWallet.connect(bob).deposit({ value: collateral });
    await vaultEngine
      .connect(bob)
      .modifyDebt(ASSET_ID.FLR, treasury.address, collateral, debt);
    balances.bob["FLR"] = { collateral, debt };
    balances.bob["USD"] = RAY.mul(debt);
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    expectedTotalStablecoin = expectedTotalStablecoin.add(debt.mul(RAY));
    await expectBalancesToMatch(bob, balances.bob);

    // Bob utilizes 150,000 FXRP ($417,000) to BORROW 135,000 USD
    (collateral = WAD.mul(150_000)), (debt = WAD.mul(135_000));
    await depositFxrp(bob, collateral);
    await vaultEngine
      .connect(bob)
      .modifyDebt(ASSET_ID["FXRP"], treasury.address, collateral, debt);
    balances.bob["FXRP"] = { collateral, debt };
    balances.bob["USD"] = balances.bob["USD"].add(debt.mul(RAY));
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    expectedTotalStablecoin = expectedTotalStablecoin.add(debt.mul(RAY));
    await expectBalancesToMatch(bob, balances.bob);

    // Charlie utilizes 400,000 FXRP ($1,112,000) to MINT 150,000 USD
    (underlying = WAD.mul(400_000)), (equity = WAD.mul(150_000));
    await depositFxrp(charlie, underlying);
    await vaultEngine
      .connect(charlie)
      .modifyEquity(ASSET_ID["FXRP"], treasury.address, underlying, equity);
    balances.charlie["FXRP"] = { underlying, equity };
    await expectBalancesToMatch(charlie, balances.charlie);

    // Charlie utilizes 200,000 FXRP ($556,000) to BORROW 150,000 USD
    (collateral = WAD.mul(200_000)), (debt = WAD.mul(150_000));
    await depositFxrp(charlie, collateral);
    await vaultEngine
      .connect(charlie)
      .modifyDebt(ASSET_ID["FXRP"], treasury.address, collateral, debt);
    balances.charlie["FXRP"] = { collateral, debt };
    balances.charlie["USD"] = debt.mul(RAY);
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    expectedTotalStablecoin = expectedTotalStablecoin.add(debt.mul(RAY));
    await expectBalancesToMatch(charlie, balances.charlie);

    // Don utilizes 6900 FLR ($7590) to BORROW 4500 USD
    (collateral = WAD.mul(6900)), (debt = WAD.mul(4500));
    await flrWallet.connect(don).deposit({ value: collateral });
    await vaultEngine
      .connect(don)
      .modifyDebt(ASSET_ID.FLR, treasury.address, collateral, debt);
    balances.don["FLR"] = { collateral, debt };
    balances.don["USD"] = RAY.mul(debt);
    expectedTotalDebt = expectedTotalDebt.add(debt.mul(RAY));
    expectedTotalStablecoin = expectedTotalStablecoin.add(debt.mul(RAY));
    await expectBalancesToMatch(don, balances.don);

    // Total debt should be 291,000 USD
    expect(await vaultEngine.lendingPoolDebt()).to.equal(expectedTotalDebt);
    expect(await vaultEngine.lendingPoolSupply()).to.equal(
      expectedTotalStablecoin
    );

    // Drop prices (FLR: $1.10 => $0.60), FXRP: ($2.78 => $1.23)
    await ftsoFlr.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(60).div(100));
    await priceFeed.updateAdjustedPrice(ASSET_ID.FLR);
    await ftsoFxrp.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(123).div(100));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FXRP"]);

    /**
     * Start 2 auctions, 1 of each collateral (FLR, FXRP).
     */

    // Liquidate Bob's FLR vault ($1380 backing 1500 AUR)
    await liquidator.liquidateVault(ASSET_ID.FLR, bob.address);
    let newDebtToCover = balances.bob["FLR"].debt?.mul(RAY)!;
    reserveBalances.debtToCover = newDebtToCover;
    expectedTotalDebt = expectedTotalDebt.sub(newDebtToCover);
    expect(await vaultEngine.lendingPoolDebt()).to.equal(expectedTotalDebt);
    await checkReserveBalances(reserveBalances);

    // Liquidate Bob's FXRP vault ($184,500 backing 135,000 USD)
    await liquidator.liquidateVault(ASSET_ID["FXRP"], bob.address);
    newDebtToCover = balances.bob["FXRP"].debt?.mul(RAY)!;
    expectedTotalDebt = expectedTotalDebt.sub(newDebtToCover);
    reserveBalances.debtToCover =
      reserveBalances.debtToCover.add(newDebtToCover);
    expect(await vaultEngine.lendingPoolDebt()).to.equal(expectedTotalDebt);
    await checkReserveBalances(reserveBalances);

    // Update expected balances
    (collateral = WAD.mul(0)), (debt = WAD.mul(0));
    balances.bob["FLR"] = { collateral, debt };
    balances.bob["FXRP"] = { collateral, debt };
    await expectBalancesToMatch(bob, balances.bob);

    /**
     * Increase unbacked system debt and start IOU sale
     */

    // Give owner the gov role for testing purposes below
    await registry.setupAddress(bytes32("gov"), owner.address, true);

    // Increase debt threshold to 5000 * 1.2 = 6000
    const newDebtThreshold = DEBT_THRESHOLD.mul(12).div(10);
    await reserve.connect(owner).increaseSystemDebt(newDebtThreshold);
    expectedTotalStablecoin = expectedTotalStablecoin.add(newDebtThreshold);
    expect(await vaultEngine.lendingPoolSupply()).to.equal(
      expectedTotalStablecoin
    );
    reserveBalances.reserve = newDebtThreshold;
    reserveBalances.debtToCover =
      reserveBalances.debtToCover.add(newDebtThreshold);

    await checkReserveBalances(reserveBalances);

    // Send all reserve stablecoins to Bob (as a proxy for pool diminishment)
    await reserve.connect(owner).sendStablecoin(bob.address, newDebtThreshold);
    reserveBalances.reserve = RAD.mul(0);
    await checkReserveBalances(reserveBalances);

    // Expect Bob's stablecoin balance to increase
    balances.bob["USD"] = balances.bob["USD"].add(newDebtThreshold);
    await expectBalancesToMatch(bob, balances.bob);

    // Charlie purchases 5000 * 0.75 = 3750 tokens
    await reserve.startBondSale();
    let amountOfTokens = DEBT_THRESHOLD.mul(3).div(4);
    await bondIssuer.connect(charlie).purchaseBond(amountOfTokens);
    await reserve.settle(amountOfTokens);
    reserveBalances.debtToCover =
      reserveBalances.debtToCover.sub(amountOfTokens);
    await checkReserveBalances(reserveBalances);

    // Expect Charlie's stablecoin balance to decrease after purchase
    balances.charlie["USD"] = balances.charlie["USD"].sub(amountOfTokens);
    await expectBalancesToMatch(charlie, balances.charlie);

    // Bob purchases 5000 * 0.25 = 1250 tokens; all bad debt has been covered
    amountOfTokens = DEBT_THRESHOLD.div(4);
    await bondIssuer.connect(bob).purchaseBond(amountOfTokens);
    await reserve.settle(amountOfTokens);
    reserveBalances.debtToCover =
      reserveBalances.debtToCover.sub(amountOfTokens);
    await checkReserveBalances(reserveBalances);

    // Expect Bob's stablecoin balance to decrease after purchase
    balances.bob["USD"] = balances.bob["USD"].sub(amountOfTokens);
    await expectBalancesToMatch(bob, balances.bob);

    /**
     * Replenish system reserves (enough to cover all bad debt, with extra left over)
     */

    // Bob (as a proxy for protocol replenishment) transfers 7000 USD to the reserve pool
    await treasury
      .connect(bob)
      .transferStablecoin(reserve.address, WAD.mul(7000));

    // Expect reserve to be replenished and Bob's balance to decrease
    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(7000));
    await checkReserveBalances(reserveBalances);
    balances.bob["USD"] = balances.bob["USD"].sub(RAD.mul(7000));
    await expectBalancesToMatch(bob, balances.bob);

    // Charlie transfers 140_000 USD to the reserve pool
    await treasury
      .connect(charlie)
      .transferStablecoin(reserve.address, WAD.mul(140_000));

    // Expect reserve to increase and Charlie's balance to decrease
    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(140_000));
    await checkReserveBalances(reserveBalances);
    balances.charlie["USD"] = balances.charlie["USD"].sub(RAD.mul(140_000));
    await expectBalancesToMatch(charlie, balances.charlie);

    /**
     * Shutdown
     */

    // Initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);

    // Drop prices - FLR: ($60 => $0.42), FXRP: ($1.23 => $1.03)
    await ftsoFlr.setCurrentPrice(BigNumber.from(1e5).mul(42).div(100));
    await ftsoFxrp.setCurrentPrice(BigNumber.from(1e5).mul(103).div(100));

    // Set final prices and expect them to be updated
    await shutdown.setFinalPrice(ASSET_ID.FLR);
    expect((await shutdown.assets(ASSET_ID.FLR)).finalPrice).to.equal(
      RAY.mul(42).div(100)
    );
    await shutdown.setFinalPrice(ASSET_ID["FXRP"]);
    expect((await shutdown.assets(ASSET_ID["FXRP"])).finalPrice).to.equal(
      RAY.mul(103).div(100)
    );

    // Process debt for FLR vaults
    await shutdown.processUserDebt(ASSET_ID.FLR, alice.address);

    // Expect shortfall to be zero since Alice never borrowed
    let EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(ASSET_ID.FLR)).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // Expect shortfall to be zero since Bob's collateral is on auction
    await shutdown.processUserDebt(ASSET_ID.FLR, bob.address);
    expect((await shutdown.assets(ASSET_ID.FLR)).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // Expect shortfall to be zero because Charlie doesn't have a FLR vault
    await shutdown.processUserDebt(ASSET_ID.FLR, charlie.address);
    expect((await shutdown.assets(ASSET_ID.FLR)).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // Don owed 4500 AUR; value of coll: 69_000 FLR * $0.42 per collateral unit = $2898
    // AUR shortfall should be 1602 and collateral shortfall should be 3814.28571429
    await shutdown.processUserDebt(ASSET_ID.FLR, don.address);
    EXPECTED_FLR_GAP = "3814285714285714285714";
    let EXPECTED_AUR_GAP = RAD.mul(1602);
    expect((await shutdown.assets(ASSET_ID.FLR)).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    expect(
      (await shutdown.stablecoinGap()).sub(EXPECTED_AUR_GAP).abs().lte(RAD)
    ).to.equal(true);

    // Process debt for FXRP collateral
    await shutdown.processUserDebt(ASSET_ID["FXRP"], alice.address);
    await shutdown.processUserDebt(ASSET_ID["FXRP"], bob.address);
    await shutdown.processUserDebt(ASSET_ID["FXRP"], charlie.address);
    await shutdown.processUserDebt(ASSET_ID["FXRP"], don.address);

    const EXPECTED_FXRP_GAP = 0;

    expect((await shutdown.assets(ASSET_ID["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    // Increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // Use the system reserve to pay off unbacked system debt
    await reserve.settle(RAD.mul(137_500));
    reserveBalances.reserve = reserveBalances.reserve.sub(RAD.mul(137_500));
    reserveBalances.debtToCover = reserveBalances.debtToCover.sub(
      RAD.mul(137_500)
    );
    await checkReserveBalances(reserveBalances);
    await shutdown.writeOffFromReserves();
    reserveBalances.reserve = reserveBalances.reserve.sub(RAD.mul(137_500));

    // Set the finalized unbacked debt balance due after processing borrowers
    await shutdown.setFinalStablecoinBalance();
    const res = await vaultEngine.lendingPoolSupply();
    const EXPECTED_FINAL_STABLECOIN_BALANCE = RAD.mul(154_500);

    // Calculate the investor obligation
    await shutdown.calculateInvestorObligation();

    // Expect investor obligation ratio to be zero
    const EXPECTED_SUPPLIER_OBLIGATION_RATIO = 0;
    expect(await shutdown.investorObligationRatio()).to.equal(
      EXPECTED_SUPPLIER_OBLIGATION_RATIO
    );

    // Increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // Expect final debt balance to equal the previous calculation after two days (?)
    expect(await shutdown.finalStablecoinBalance()).to.equal(
      EXPECTED_FINAL_STABLECOIN_BALANCE
    );

    // Calcuate redemption ratio for FLR
    await shutdown.calculateRedemptionRatio(ASSET_ID.FLR);
    // Redeemption ratio = (theoretical max - gap) / total stablecoin in circulation
    // (10714285714285714285714 - 3814285714285714285714) / 154_500
    // 6900000000000000000000 / 154_500
    // 6900 / 154_500 = 0.0446601941

    const EXPECTED_FLR_REDEMPTION_RATIO = "44660194174757281553398058";
    expect((await shutdown.assets(ASSET_ID.FLR)).redemptionRatio).to.equal(
      EXPECTED_FLR_REDEMPTION_RATIO
    );

    // Calcuate redemption ratio for FXRP
    await shutdown.calculateRedemptionRatio(ASSET_ID["FXRP"]);
    // Redeemption ratio = (theoretical max - gap) / total stablecoin in circulation
    // 150_000 - 1.03 / 154_500 = 0.9425959091 (?)
    const EXPECTED_FXRP_REDEMPTION_RATIO = "942595909133754359506077669";
    expect((await shutdown.assets(ASSET_ID["FXRP"])).redemptionRatio).to.equal(
      EXPECTED_FXRP_REDEMPTION_RATIO
    );

    await shutdown.connect(bob).returnStablecoin(RAD.mul(65000 + 1500));
    expect(await shutdown.stablecoin(bob.address)).to.equal(
      RAD.mul(65000 + 1500)
    );

    // Redeem collateral
    let before = (await vaultEngine.vaults(ASSET_ID.FLR, bob.address)).standby;
    await shutdown.connect(bob).redeemAsset(ASSET_ID.FLR);
    let after = (await vaultEngine.vaults(ASSET_ID.FLR, bob.address)).standby;
    // Redemption ratio * stablecoin returned
    // 0.0446601941 * 66500 = 2969.90290765
    const EXPECTED_FLR_COLL_REDEEMED = WAD.mul(296990290765).div(1e8);
    // We are okay with up to 0.001 collateral difference
    expect(
      after.sub(before).sub(EXPECTED_FLR_COLL_REDEEMED).lte(WAD.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(ASSET_ID["FXRP"], bob.address)).standby;
    await shutdown.connect(bob).redeemAsset(ASSET_ID["FXRP"]);
    after = (await vaultEngine.vaults(ASSET_ID["FXRP"], bob.address)).standby;

    // Redemption ratio * stablecoins returned
    // 0.9425959091 * 66500 = 62682.6279552
    const EXPECTED_FXRP_COLL_REDEEMED = WAD.mul("626826279552").div(1e7);
    // We are okay with up to 0.001 collateral difference
    expect(
      after.sub(before).sub(EXPECTED_FXRP_COLL_REDEEMED).lte(WAD.div(100))
    ).to.equal(true);

    // set the final system reserve balance
    await shutdown.setFinalSystemReserve();
    const EXPECTED_FINAL_TOTAL_RESERVE = RAD.mul(7898);
    expect(
      (await shutdown.finalTotalReserve())
        .sub(EXPECTED_FINAL_TOTAL_RESERVE)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);

    // Bob redeems his bond tokens
    before = await bondIssuer.bondTokens(bob.address);
    await shutdown.connect(bob).redeemBondTokens();
    after = await bondIssuer.bondTokens(bob.address);
    const EXPECTED_IOU_BALANCE_CHANGE = DEBT_THRESHOLD.div(4);
    expect(before.sub(after)).to.equal(EXPECTED_IOU_BALANCE_CHANGE);
  });

  it("should shutdown when the system is no longer solvent", async () => {
    let expectedTotalDebt = BigNumber.from(0); // rad
    let expectedTotalEquity = BigNumber.from(0); // rad
    // Current collateral ratio: 150%
    // Starting prices: (FLR: $4.30, FXRP: $6.23)
    await ftsoFlr.setCurrentPrice(RAY.mul(43).div(10));
    await priceFeed.updateAdjustedPrice(ASSET_ID.FLR);
    await ftsoFxrp.setCurrentPrice(RAY.mul(623).div(100));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FXRP"]);

    // Have at least 4 vaults that are undercollateralized
    await flrWallet
      .connect(alice)
      .deposit({ value: ethers.utils.parseEther("4500") });
    await depositFxrp(alice, WAD.mul(1000000));
    await vaultEngine
      .connect(alice)
      .modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        WAD.mul(4500),
        WAD.mul(5000)
      );
    expectedTotalEquity = expectedTotalEquity.add(RAD.mul(5000));
    balances.alice["FLR"] = {
      underlying: WAD.mul(4500),
      equity: WAD.mul(5000),
    };

    await vaultEngine
      .connect(alice)
      .modifyEquity(
        ASSET_ID["FXRP"],
        treasury.address,
        WAD.mul(1000000),
        WAD.mul(2000000)
      );
    expectedTotalEquity = expectedTotalEquity.add(RAD.mul(2000000));
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
      .modifyDebt(ASSET_ID.FLR, treasury.address, WAD.mul(2300), WAD.mul(6000));
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(6000));
    balances.bob["FLR"] = {
      collateral: WAD.mul(2300),
      debt: WAD.mul(6000),
    };
    await vaultEngine
      .connect(bob)
      .modifyDebt(
        ASSET_ID["FXRP"],
        treasury.address,
        WAD.mul(270_000),
        WAD.mul(1_100_000)
      );
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(1_100_000));
    balances.bob["FXRP"] = {
      collateral: WAD.mul(270_000),
      debt: WAD.mul(1_100_000),
    };
    balances.bob["USD"] = RAD.mul(6000 + 1_100_000);
    await expectBalancesToMatch(bob, balances.bob);

    await flrWallet
      .connect(charlie)
      .deposit({ value: ethers.utils.parseEther("9000") });
    await vaultEngine
      .connect(charlie)
      .modifyDebt(
        ASSET_ID.FLR,
        treasury.address,
        WAD.mul(9000),
        WAD.mul(15_000)
      );
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(15_000));
    await vaultEngine
      .connect(charlie)
      .modifyDebt(ASSET_ID.FLR, treasury.address, WAD.mul(0), WAD.mul(10_000));
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(10_000));
    balances.charlie["FLR"] = {
      collateral: WAD.mul(9000),
      debt: WAD.mul(10_000 + 15_000),
    };
    balances.charlie["USD"] = RAD.mul(15_000 + 10_000);
    await expectBalancesToMatch(charlie, balances.charlie);

    await depositFxrp(don, WAD.mul(1_020_000));
    await vaultEngine
      .connect(don)
      .modifyEquity(
        ASSET_ID["FXRP"],
        treasury.address,
        WAD.mul(20_000),
        WAD.mul(1_000_000)
      );
    expectedTotalEquity = expectedTotalEquity.add(RAD.mul(1_000_000));
    await vaultEngine
      .connect(don)
      .modifyDebt(
        ASSET_ID["FXRP"],
        treasury.address,
        WAD.mul(620_000),
        WAD.mul(1_500_000)
      );
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(1_500_000));
    balances.don["FXRP"] = {
      underlying: WAD.mul(20_000),
      collateral: WAD.mul(620_000),
      debt: WAD.mul(1_500_000),
      equity: WAD.mul(1_000_000),
    };
    balances.don["USD"] = RAD.mul(1_500_000);
    await expectBalancesToMatch(don, balances.don);

    await flrWallet
      .connect(lender)
      .deposit({ value: ethers.utils.parseEther("2000") });
    await depositFxrp(lender, WAD.mul(3_830_000));
    await vaultEngine
      .connect(lender)
      .modifyEquity(
        ASSET_ID.FLR,
        treasury.address,
        WAD.mul(1000),
        WAD.mul(1500)
      );
    expectedTotalEquity = expectedTotalEquity.add(RAD.mul(1500));
    await vaultEngine
      .connect(lender)
      .modifyDebt(ASSET_ID.FLR, treasury.address, WAD.mul(1000), WAD.mul(1500));
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(1500));

    balances.lender["FLR"] = {
      underlying: WAD.mul(1000),
      collateral: WAD.mul(1000),
      debt: WAD.mul(1500),
      equity: WAD.mul(1500),
    };

    await vaultEngine
      .connect(lender)
      .modifyEquity(
        ASSET_ID["FXRP"],
        treasury.address,
        WAD.mul(1_830_000),
        WAD.mul(1_500_000)
      );
    expectedTotalEquity = expectedTotalEquity.add(RAD.mul(1_500_000));
    await vaultEngine
      .connect(lender)
      .modifyDebt(
        ASSET_ID["FXRP"],
        treasury.address,
        WAD.mul(1_830_000),
        WAD.mul(1_200_000)
      );
    expectedTotalDebt = expectedTotalDebt.add(RAD.mul(1_200_000));
    balances.lender["FXRP"] = {
      underlying: WAD.mul(1_830_000),
      collateral: WAD.mul(1_830_000),
      debt: WAD.mul(1_200_000),
      equity: WAD.mul(1_500_000),
    };
    balances.lender["USD"] = RAD.mul(1_200_000 + 1500);
    await expectBalancesToMatch(lender, balances.lender);

    const totalDebt = await vaultEngine.lendingPoolDebt();
    const lendingPoolEquity = await vaultEngine.lendingPoolEquity();
    expect(totalDebt).to.equal(expectedTotalDebt);
    expect(lendingPoolEquity).to.equal(expectedTotalEquity);

    // New collateral ratio: 175%
    // Drop prices FLR: $3.60, FXRP: $4.48
    await priceFeed.updateLiquidationRatio(ASSET_ID.FLR, WAD.mul(175).div(100));
    await priceFeed.updateLiquidationRatio(
      ASSET_ID["FXRP"],
      WAD.mul(175).div(100)
    );
    await ftsoFlr.setCurrentPrice(BigNumber.from(1e5).mul(360).div(100));
    await priceFeed.updateAdjustedPrice(ASSET_ID.FLR);
    await ftsoFxrp.setCurrentPrice(BigNumber.from(1e5).mul(448).div(100));
    await priceFeed.updateAdjustedPrice(ASSET_ID["FXRP"]);

    // Start 2 auctions, 1 of each collateral

    await liquidator.liquidateVault(ASSET_ID.FLR, bob.address);
    expectedTotalDebt = expectedTotalDebt.sub(balances.bob.FLR.debt?.mul(RAY)!);
    balances.bob["FLR"] = {
      collateral: WAD.mul(0),
      debt: WAD.mul(0),
    };
    reserveBalances.debtToCover = RAD.mul(6000);
    await checkReserveBalances(reserveBalances);

    await liquidator.liquidateVault(ASSET_ID["FXRP"], bob.address);
    expectedTotalDebt = expectedTotalDebt.sub(
      balances.bob.FXRP.debt?.mul(RAY)!
    );
    balances.bob["FXRP"] = {
      collateral: WAD.mul(0),
      debt: WAD.mul(0),
    };
    reserveBalances.debtToCover = reserveBalances.debtToCover.add(
      RAD.mul(1_100_000)
    );
    await checkReserveBalances(reserveBalances);

    // Put system reserve to fill up some gap but not entirely
    await treasury
      .connect(bob)
      .transferStablecoin(reserve.address, WAD.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(7000));
    await checkReserveBalances(reserveBalances);
    balances.bob["USD"] = balances.bob["USD"].sub(RAD.mul(7000));
    await expectBalancesToMatch(bob, balances.bob);

    await treasury
      .connect(don)
      .transferStablecoin(reserve.address, WAD.mul(140_000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(140_000));
    await checkReserveBalances(reserveBalances);
    balances.don["USD"] = balances.don["USD"].sub(RAD.mul(140_000));
    await expectBalancesToMatch(don, balances.don);

    // Initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);
    expect(await shutdown.finalUtilizationRatio()).to.equal(
      wdiv(expectedTotalDebt, expectedTotalEquity)
    );

    // Drop prices: (FLR => $2.23, FXRP => $2.20)
    await ftsoFlr.setCurrentPrice(BigNumber.from(1e5).mul(223).div(100));
    await ftsoFxrp.setCurrentPrice(BigNumber.from(1e5).mul(220).div(100));

    // Set final prices
    await shutdown.setFinalPrice(ASSET_ID.FLR);
    expect((await shutdown.assets(ASSET_ID.FLR)).finalPrice).to.equal(
      RAY.mul(223).div(100)
    );
    await shutdown.setFinalPrice(ASSET_ID["FXRP"]);
    expect((await shutdown.assets(ASSET_ID["FXRP"])).finalPrice).to.equal(
      RAY.mul(220).div(100)
    );

    // Process debt for FLR collateral
    await shutdown.processUserDebt(ASSET_ID.FLR, alice.address);
    let EXPECTED_FLR_GAP = WAD.mul(0);
    expect((await shutdown.assets(ASSET_ID.FLR)).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    await shutdown.processUserDebt(ASSET_ID.FLR, bob.address);
    expect((await shutdown.assets(ASSET_ID.FLR)).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    await shutdown.processUserDebt(ASSET_ID.FLR, charlie.address);

    // user 3 have debt of $25000 and have 9000 FLR coll @ 2.23 = $20070
    // stablecoinGap should be 25000 - 20070 = 4930
    // collGap should be 4930 / 2.23 = 2210.76233184
    EXPECTED_FLR_GAP = WAD.mul("221076233184").div(1e8);
    let EXPECTED_AUR_GAP = RAD.mul(4930);
    expect(
      (await shutdown.stablecoinGap())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    await shutdown.processUserDebt(ASSET_ID.FLR, don.address);
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(ASSET_ID.FLR, lender.address);
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // Process debt for FXRP collateral
    await shutdown.processUserDebt(ASSET_ID["FXRP"], alice.address);
    let EXPECTED_FXRP_GAP = WAD.mul(0);
    expect((await shutdown.assets(ASSET_ID["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(ASSET_ID["FXRP"], bob.address);
    expect((await shutdown.assets(ASSET_ID["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(ASSET_ID["FXRP"], charlie.address);
    expect((await shutdown.assets(ASSET_ID["FXRP"])).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(ASSET_ID["FXRP"], don.address);
    // user 4 have debt of $1500000, coll value: 620000 * 2.20 = 1364000
    // stablecoinGap should be 1500000 - 1364000 = 136000
    // collGap should be 136000 / 2.20 = 61818.1818182
    EXPECTED_FXRP_GAP = WAD.mul("618181818182").div(1e7);
    EXPECTED_AUR_GAP = EXPECTED_AUR_GAP.add(RAD.mul(136_000));
    let stablecoinGap = await shutdown.stablecoinGap();
    expect(
      stablecoinGap.sub(EXPECTED_AUR_GAP).abs().lte(RAD.div(100))
    ).to.equal(true);
    const gap = (await shutdown.assets(ASSET_ID["FXRP"])).gap;
    expect(gap.sub(EXPECTED_FXRP_GAP).abs().lte(WAD.div(100))).to.equal(true);

    await shutdown.processUserDebt(ASSET_ID["FXRP"], lender.address);
    stablecoinGap = await shutdown.stablecoinGap();

    expect(
      (await shutdown.stablecoinGap())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // Fast forward by two days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // Use the system reserve to settle system debt
    await reserve.settle(RAD.mul(147_000));

    // Set the final debt balance
    await shutdown.setFinalStablecoinBalance();
    const EXPECTED_FINAL_STABLECOIN_BALANCE = RAD.mul(3_685_500);
    expect(await shutdown.finalStablecoinBalance()).to.equal(
      EXPECTED_FINAL_STABLECOIN_BALANCE
    );

    await shutdown.calculateInvestorObligation();

    // total stablecoinGap 140930
    // total equity * final utilization Ratio = total equity in use
    // $4506500 * 0.605014978364584489 = 2726500
    // total stablecoinGap / total equity in use = supplier obligation ratio
    // 140930 / 2726500 = 0.05168897854

    const EXPECTED_SUPPLIER_OBLIGATION_RATIO = WAD.mul("5168897854").div(1e11);
    expect(
      (await shutdown.investorObligationRatio())
        .sub(EXPECTED_SUPPLIER_OBLIGATION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    // process supplier for flr collateral
    await shutdown.processUserEquity(ASSET_ID.FLR, alice.address);
    // user 1 has supplied $5000, 0.605014978364584489 = 3025.07489182 on hook
    // supplied amount * supplier obligation ratio
    // 3025.07489182  * 0.05168897854 = 156.363031165
    // coll amount = 156.363031165 / 2.23 = 70.1179511951
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(WAD.mul("701179511951").div(1e10));
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSET_ID.FLR, bob.address);
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    await shutdown.processUserEquity(ASSET_ID.FLR, charlie.address);
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSET_ID.FLR, don.address);
    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSET_ID.FLR, lender.address);

    // lender supplied $1500 * 0.605014978364584489 = 907.522467547
    // 907.522467547 * 0.05168897854 = 46.9089093496
    // 48.779919975 / 2.23 = 21.0353853586
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(WAD.mul("210353853586").div(1e10));

    expect(
      (await shutdown.assets(ASSET_ID.FLR)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // process supplier for fxrp collateral
    await shutdown.processUserEquity(ASSET_ID["FXRP"], alice.address);
    // alice supplied $2000000 * 0.605014978364584489 = 1210029.95673
    // 1700876.5117 * 0.05168897854 = 62545.2124661
    // 62545.2124661 / 2.20 = 28429.6420301
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(WAD.mul("284296420301").div(1e7));
    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSET_ID["FXRP"], bob.address);
    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSET_ID["FXRP"], charlie.address);
    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(ASSET_ID["FXRP"], don.address);

    // don supplied $1_000_000 * 0.605014978364584489 = 605014.978365
    // 605014.978365 * 0.05168897854 = 31272.6062331
    // 31272.6062331 / 2.20 = 14214.821015
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(WAD.mul("14214821015").div(1e6));
    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    EXPECTED_FXRP_GAP = WAD.mul(0);
    await shutdown.processUserEquity(ASSET_ID["FXRP"], lender.address);
    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // calcuate redemption ratio
    await shutdown.calculateRedemptionRatio(ASSET_ID.FLR);
    // redemption ratio = theoretical max - gap / total["AUR"] in circulation
    // ((26500 / $2.23) - 2119.6089952863 / $3685500
    // 11883.4080717 - 2119.6089952863 = 9763.79907641
    // 9763.79907641 / 3685500 = 0.00264924679

    const EXPECTED_FLR_REDEMPTION_RATIO = RAY.mul("264924679").div(1e11);

    expect(
      (await shutdown.assets(ASSET_ID.FLR)).redemptionRatio
        .sub(EXPECTED_FLR_REDEMPTION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    await shutdown.calculateRedemptionRatio(ASSET_ID["FXRP"]);
    // redemption ratio = theoretical max - gap / total["USD"] in circulation
    // ((2700000 / $2.20) - 0/ $3685500
    // 1227272.72727 - 0= 1227272.72727
    // 1227272.72727 / 3685500 = 0.333000333
    const EXPECTED_FXRP_REDEMPTION_RATIO = RAY.mul("333000333").div(1e9);

    expect(
      (await shutdown.assets(ASSET_ID["FXRP"])).redemptionRatio
        .sub(EXPECTED_FXRP_REDEMPTION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // return stablecoin
    await shutdown.connect(bob).returnStablecoin(RAD.mul(1_099_000));
    expect(await vaultEngine.systemCurrency(bob.address)).to.equal(0);

    // redeem collateral
    let before = (await vaultEngine.vaults(ASSET_ID.FLR, bob.address)).standby;
    await shutdown.connect(bob).redeemAsset(ASSET_ID.FLR);
    let after = (await vaultEngine.vaults(ASSET_ID.FLR, bob.address)).standby;
    // bob["AUR"] balance: 1099000
    //["AUR"] balance * flr Redeemed Asset
    // 1099000 * 0.00264924679 = 2911.52222221
    const EXPECTED_FLR_COLL_REDEEMED = WAD.mul("291152222221").div(1e8);
    expect(
      after.sub(before).sub(EXPECTED_FLR_COLL_REDEEMED).abs().lte(WAD.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(ASSET_ID["FXRP"], bob.address)).standby;
    await shutdown.connect(bob).redeemAsset(ASSET_ID["FXRP"]);
    after = (await vaultEngine.vaults(ASSET_ID["FXRP"], bob.address)).standby;
    // bob["USD"] balance: 1099000
    //["USD"] balance * flr Redeemed Asset
    // 1099000 * 0.333000333 = 365967.365967
    const EXPECTED_FXRP_COLL_REDEEMED = WAD.mul("365967365967").div(1e6);
    expect(
      after.sub(before).sub(EXPECTED_FXRP_COLL_REDEEMED).abs().lte(WAD.div(100))
    ).to.equal(true);
  });
});
