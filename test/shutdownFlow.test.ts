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
import { ethers, web3 } from "hardhat";
import fundFlr from "./utils/fundFlr";
import * as chai from "chai";
import { deployTest, mock, probity } from "../lib/deployer";
import increaseTime from "./utils/increaseTime";
import { BigNumber } from "ethers";
import { bytes32 } from "./utils/constants";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let user4: SignerWithAddress;
let user5: SignerWithAddress;
let user6: SignerWithAddress;

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

const WAD = ethers.BigNumber.from("1000000000000000000");
const RAY = ethers.BigNumber.from("1000000000000000000000000000");
const RAD = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

let flrAssetId = web3.utils.keccak256("FLR");
let fxrpAssetId = web3.utils.keccak256("FXRP");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function fxrpDeposit(user, amount) {
  await erc20.mint(user.address, amount);
  await erc20.connect(user).approve(fxrpWallet.address, amount);
  await fxrpWallet.connect(user).deposit(amount);
}

async function expectBalancesToMatch(user, balance) {
  if (balance.stablecoin !== undefined) {
    let stablecoin = await vaultEngine.stablecoin(user.address);

    expect(stablecoin).to.equal(balance.stablecoin);
  }

  if (balance.flr !== undefined) {
    let vault = await vaultEngine.vaults(flrAssetId, user.address);

    if (balance.flr.activeAmount !== undefined) {
      expect(vault.activeAssetAmount).to.equal(balance.flr.activeAmount);
    }

    if (balance.flr.debt !== undefined) {
      expect(vault.debt).to.equal(balance.flr.debt);
    }
    if (balance.flr.equity !== undefined) {
      expect(vault.equity).to.equal(balance.flr.equity);
    }
  }

  if (balance.fxrp !== undefined) {
    let vault = await vaultEngine.vaults(fxrpAssetId, user.address);

    if (balance.fxrp.activeAmount !== undefined) {
      expect(vault.activeAssetAmount).to.equal(balance.fxrp.activeAmount);
    }

    if (balance.fxrp.debt !== undefined) {
      expect(vault.debt).to.equal(balance.fxrp.debt);
    }
    if (balance.fxrp.equity !== undefined) {
      expect(vault.equity).to.equal(balance.fxrp.equity);
    }
  }
}

async function checkReserveBalances(reserveBalances) {
  expect(await vaultEngine.stablecoin(reserve.address)).to.equal(
    reserveBalances.reserve
  );
  expect(await vaultEngine.unbackedDebt(reserve.address)).to.equal(
    reserveBalances.debt
  );
}

describe("Shutdown Flow Test", function () {
  const TWO_DAYS_IN_SECONDS = 86400 * 2;
  const DEBT_THRESHOLD = RAD.mul(5000);
  let balances: {
    [key: string]: {
      flr: {
        debt?: BigNumber;
        activeAmount?: BigNumber;
        equity?: BigNumber;
      };
      fxrp: {
        debt?: BigNumber;
        activeAmount?: BigNumber;
        equity?: BigNumber;
      };
      stablecoin: BigNumber;
    };
  };
  let reserveBalances;

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
    user1 = signers.alice;
    user2 = signers.bob;
    user3 = signers.charlie;
    user4 = signers.don;
    user5 = signers.lender;
    user6 = signers.borrower;

    await vaultEngine.initAssetType(flrAssetId);
    await vaultEngine.updateCeiling(flrAssetId, RAD.mul(10000000));
    await teller.initCollType(flrAssetId, 0);
    await priceFeed.init(flrAssetId, WAD.mul(15).div(10), ftsoFlr.address);
    await liquidator.init(flrAssetId, auctioneerFlr.address);

    await vaultEngine.initAssetType(fxrpAssetId);
    await vaultEngine.updateCeiling(fxrpAssetId, RAD.mul(10000000));
    await teller.initCollType(fxrpAssetId, 0);
    await priceFeed.init(fxrpAssetId, WAD.mul(15).div(10), ftsoFxrp.address);
    await liquidator.init(fxrpAssetId, auctioneerFxrp.address);
    await reserve.updateDebtThreshold(DEBT_THRESHOLD);

    balances = {
      user1: { flr: {}, fxrp: {}, stablecoin: WAD.mul(0) },
      user2: { flr: {}, fxrp: {}, stablecoin: WAD.mul(0) },
      user3: { flr: {}, fxrp: {}, stablecoin: WAD.mul(0) },
      user4: { flr: {}, fxrp: {}, stablecoin: WAD.mul(0) },
      user5: { flr: {}, fxrp: {}, stablecoin: WAD.mul(0) },
      user6: { flr: {}, fxrp: {}, stablecoin: WAD.mul(0) },
    };
    reserveBalances = {
      reserve: WAD.mul(0),
      debt: WAD.mul(0),
    };

    await registry.setupAddress(bytes32("whitelisted"), user1.address);
    await registry.setupAddress(bytes32("whitelisted"), user2.address);
    await registry.setupAddress(bytes32("whitelisted"), user3.address);
    await registry.setupAddress(bytes32("whitelisted"), user4.address);
    await registry.setupAddress(bytes32("whitelisted"), user5.address);
    await registry.setupAddress(bytes32("whitelisted"), user6.address);
    // await registry.setupAddress(bytes32("whitelisted"), owner.address)
  });

  it("test happy flow where system is solvent", async () => {
    // sets up scenario for solvent system.
    // current collateral ratio: 150%

    // FLR = $1.10
    await ftsoFlr.setCurrentPrice(RAY.mul(11).div(10));
    await priceFeed.updateAdjustedPrice(flrAssetId);

    // FXRP = $2.78
    await ftsoFxrp.setCurrentPrice(RAY.mul(278).div(100));
    await priceFeed.updateAdjustedPrice(fxrpAssetId);

    /**
     * Set up 4 users with 3 unhealthy vaults
     */

    let expectedTotalDebt = 0;

    // User 1 activates 2300 FLR to MINT 1000 AUR
    await flrWallet
      .connect(user1)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await vaultEngine
      .connect(user1)
      .modifyEquity(flrAssetId, treasury.address, WAD.mul(2300), RAD.mul(1000));
    balances.user1.flr = {
      activeAmount: WAD.mul(2300),
      equity: WAD.mul(1000),
    };
    // User 1 activates 1_000_000 FXRP to MINT 300_000 AUR
    await fxrpDeposit(user1, WAD.mul(1_000_000));
    await vaultEngine
      .connect(user1)
      .modifyEquity(
        fxrpAssetId,
        treasury.address,
        WAD.mul(1_000_000),
        RAD.mul(300_000)
      );
    balances.user1.fxrp = {
      activeAmount: WAD.mul(1_000_000),
      equity: WAD.mul(300_000),
    };
    await expectBalancesToMatch(user1, balances.user1);

    // User 2 activates 2300 FLR to BORROW 1500 AUR
    await flrWallet
      .connect(user2)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await fxrpDeposit(user2, WAD.mul(270000));
    await vaultEngine
      .connect(user2)
      .modifyDebt(flrAssetId, treasury.address, WAD.mul(2300), RAD.mul(1500));
    balances.user2.flr = {
      activeAmount: WAD.mul(2300),
      debt: WAD.mul(1500),
    };
    expectedTotalDebt += 1500;
    // User 2 activates 150_000 FXRP to BORROW 135_000 AUR
    await vaultEngine
      .connect(user2)
      .modifyDebt(
        fxrpAssetId,
        treasury.address,
        WAD.mul(150_000),
        RAD.mul(135_000)
      );
    balances.user2.fxrp = {
      activeAmount: WAD.mul(150_000),
      debt: WAD.mul(135_000),
    };
    expectedTotalDebt += 135_000;
    balances.user2.stablecoin = RAD.mul(135_000 + 1500);
    await expectBalancesToMatch(user2, balances.user2);

    // User 3 activates 400_000 FXRP to MINT 150_000 AUR
    await fxrpDeposit(user3, WAD.mul(600_000));
    await vaultEngine
      .connect(user3)
      .modifyEquity(
        fxrpAssetId,
        treasury.address,
        WAD.mul(400_000),
        RAD.mul(150_000)
      );
    // User 3 activates 200_000 FXRP to BORROW 150_000 AUR
    await vaultEngine
      .connect(user3)
      .modifyDebt(
        fxrpAssetId,
        treasury.address,
        WAD.mul(200_000),
        RAD.mul(150_000)
      );
    balances.user3.fxrp = {
      activeAmount: WAD.mul(600_000),
      debt: WAD.mul(150_000),
      equity: WAD.mul(150_000),
    };
    expectedTotalDebt += 150_000;
    balances.user3.stablecoin = RAD.mul(150_000);
    await expectBalancesToMatch(user3, balances.user3);

    // User 4 activates 6900 FLR to BORROW 4500 AUR
    await flrWallet
      .connect(user4)
      .deposit({ value: ethers.utils.parseEther("6900") });
    await vaultEngine
      .connect(user4)
      .modifyDebt(flrAssetId, treasury.address, WAD.mul(6900), RAD.mul(4500));
    balances.user4.flr = {
      activeAmount: WAD.mul(6900),
      debt: WAD.mul(4500),
    };
    expectedTotalDebt += 4500;
    balances.user4.stablecoin = RAD.mul(4500);
    await expectBalancesToMatch(user4, balances.user4);

    // total debt should be $291,000
    expect(await vaultEngine.totalDebt()).to.equal(
      RAD.mul(BigNumber.from(expectedTotalDebt))
    );

    // drop prices (flr: $1.10 => $0.60), fxrp: ($2.78 => $1.23)
    await ftsoFlr.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(60).div(100));
    await priceFeed.updateAdjustedPrice(flrAssetId);
    await ftsoFxrp.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(123).div(100));
    await priceFeed.updateAdjustedPrice(fxrpAssetId);

    /**
     * start 2 auctions, 1 of each collateral
     */

    // Liquidate user 2 FLR vault
    await liquidator.liquidateVault(flrAssetId, user2.address);
    reserveBalances.debt = RAD.mul(1500);
    await checkReserveBalances(reserveBalances);

    // Liquidate user 2 FXRP vault
    await liquidator.liquidateVault(fxrpAssetId, user2.address);
    reserveBalances.debt = reserveBalances.debt.add(RAD.mul(135000));
    await checkReserveBalances(reserveBalances);

    // Update expected balances
    balances.user2.flr = {
      activeAmount: WAD.mul(0),
      debt: WAD.mul(0),
    };
    balances.user2.fxrp = {
      activeAmount: WAD.mul(0),
      debt: WAD.mul(0),
    };
    await expectBalancesToMatch(user2, balances.user2);

    /**
     * increase unbacked system debt and start IOU sale
     */

    // Increase by 5000 * 1.2 = 6000
    await reserve.increaseSystemDebt(DEBT_THRESHOLD.mul(12).div(10));
    reserveBalances.reserve = DEBT_THRESHOLD.mul(12).div(10);
    reserveBalances.debt = reserveBalances.debt.add(
      DEBT_THRESHOLD.mul(12).div(10)
    );
    await checkReserveBalances(reserveBalances);

    // Send all reserve stablecoins to user 2 (proxy for pool diminishment)
    await reserve.sendStablecoin(user2.address, DEBT_THRESHOLD.mul(12).div(10));
    reserveBalances.reserve = RAD.mul(0);
    await checkReserveBalances(reserveBalances);

    balances.user2.stablecoin = balances.user2.stablecoin.add(
      DEBT_THRESHOLD.mul(12).div(10)
    );
    await expectBalancesToMatch(user2, balances.user2);

    // User 3 purchases 5000 * 0.75 = 3750 vouchers
    await reserve.startSale();
    await reserve.connect(user3).purchaseVouchers(DEBT_THRESHOLD.mul(3).div(4));
    reserveBalances.debt = reserveBalances.debt.sub(
      DEBT_THRESHOLD.mul(3).div(4)
    );
    await checkReserveBalances(reserveBalances);

    balances.user3.stablecoin = balances.user3.stablecoin.sub(
      DEBT_THRESHOLD.mul(3).div(4)
    );
    await expectBalancesToMatch(user3, balances.user3);

    // User 2 purchases 5000 * 0.25 = 1250 vouchers; all bad debt has been covered
    await reserve.connect(user2).purchaseVouchers(DEBT_THRESHOLD.div(4));
    reserveBalances.debt = reserveBalances.debt.sub(DEBT_THRESHOLD.div(4));
    await checkReserveBalances(reserveBalances);

    balances.user2.stablecoin = balances.user2.stablecoin.sub(
      DEBT_THRESHOLD.div(4)
    );
    await expectBalancesToMatch(user2, balances.user2);

    /**
     * Replenish system reserves (enough to cover all bad debt, with extra left over)
     */

    // User 2 (proxy for protocol replenishment) transfers 7000 AUR to the reserve pool
    await treasury
      .connect(user2)
      .transferStablecoin(reserve.address, WAD.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(7000));
    await checkReserveBalances(reserveBalances);
    balances.user2.stablecoin = balances.user2.stablecoin.sub(RAD.mul(7000));
    await expectBalancesToMatch(user2, balances.user2);

    // User 3 transfers 140_000 AUR to the reserve pool
    await treasury
      .connect(user3)
      .transferStablecoin(reserve.address, WAD.mul(140_000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(140_000));
    await checkReserveBalances(reserveBalances);
    balances.user3.stablecoin = balances.user3.stablecoin.sub(RAD.mul(140_000));
    await expectBalancesToMatch(user3, balances.user3);

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
    await shutdown.setFinalPrice(flrAssetId);
    expect((await shutdown.assets(flrAssetId)).finalPrice).to.equal(
      RAY.mul(42).div(100)
    );
    await shutdown.setFinalPrice(fxrpAssetId);
    expect((await shutdown.assets(fxrpAssetId)).finalPrice).to.equal(
      RAY.mul(103).div(100)
    );

    // Process debt for FLR vaults
    // NOTE: gap shouldn't change for user 1 since they never borrowed
    await shutdown.processUserDebt(flrAssetId, user1.address);

    let EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(flrAssetId)).gap).to.equal(EXPECTED_FLR_GAP);

    // gap shouldn't change for user 2 since their collateral is on auction
    await shutdown.processUserDebt(flrAssetId, user2.address);

    EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(flrAssetId)).gap).to.equal(EXPECTED_FLR_GAP);

    // gap should still be zero because user 3 doesn't have a FLR vault
    await shutdown.processUserDebt(flrAssetId, user3.address);

    EXPECTED_FLR_GAP = "0";
    expect((await shutdown.assets(flrAssetId)).gap).to.equal(EXPECTED_FLR_GAP);

    // User 4 owed 4500 AUR; value of coll: 69_000 FLR * $0.42 per collateral unit = $2898
    // AUR gap should be 1602 and coll.gap should be 3814.28571429
    await shutdown.processUserDebt(flrAssetId, user4.address);

    EXPECTED_FLR_GAP = "3814285714285714285714";
    let EXPECTED_AUR_GAP = RAD.mul(1602);

    expect((await shutdown.assets(flrAssetId)).gap).to.equal(EXPECTED_FLR_GAP);
    expect(
      (await shutdown.unbackedDebt()).sub(EXPECTED_AUR_GAP).abs().lte(RAD)
    ).to.equal(true);

    // Process debt for FXRP collateral
    await shutdown.processUserDebt(fxrpAssetId, user1.address);
    await shutdown.processUserDebt(fxrpAssetId, user2.address);
    await shutdown.processUserDebt(fxrpAssetId, user3.address);
    await shutdown.processUserDebt(fxrpAssetId, user4.address);

    const EXPECTED_FXRP_GAP = 0;

    expect((await shutdown.assets(fxrpAssetId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    // Increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to pay off system debt
    await reserve.settle(RAD.mul(137_500));
    reserveBalances.reserve = reserveBalances.reserve.sub(RAD.mul(137_500));
    reserveBalances.debt = reserveBalances.debt.sub(RAD.mul(137_500));
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
    await shutdown.calculateRedemptionRatio(flrAssetId);
    // redeemption ratio = theoretical max - gap / total stablecoin in circulation
    // 10714285714285714285714 - 3814285714285714285714 (6900000000000000000000) / $154500
    // 6900 / $154500 = 0.0446601941

    const EXPECTED_FLR_REDEMPTION_RATIO = "44660194174757281553398058";
    expect((await shutdown.assets(flrAssetId)).redemptionRatio).to.equal(
      EXPECTED_FLR_REDEMPTION_RATIO
    );

    await shutdown.calculateRedemptionRatio(fxrpAssetId);
    // redemption ratio = theoretical max - gap / total stablecoin in circulation
    // 150000 / $1.03 / $154500 = 0.9425959091
    const EXPECTED_FXRP_REDEMPTION_RATIO = "942595909133754359506077669";
    expect((await shutdown.assets(fxrpAssetId)).redemptionRatio).to.equal(
      EXPECTED_FXRP_REDEMPTION_RATIO
    );

    // return stablecoin
    await shutdown.connect(user2).returnStablecoin(RAD.mul(65000 + 1500));
    expect(await shutdown.stablecoin(user2.address)).to.equal(
      RAD.mul(65000 + 1500)
    );

    // redeem collateral
    let before = (await vaultEngine.vaults(flrAssetId, user2.address))
      .standbyAssetAmount;
    await shutdown.connect(user2).redeemCollateral(flrAssetId);
    let after = (await vaultEngine.vaults(flrAssetId, user2.address))
      .standbyAssetAmount;
    // redemption ratio * stablecoin returned
    // 0.0446601941 * 66500 = 2969.90290765
    const EXPECTED_FLR_COLL_REDEEMED = WAD.mul(296990290765).div(1e8);
    // we are okay with up to 0.001 collateral difference
    expect(
      after.sub(before).sub(EXPECTED_FLR_COLL_REDEEMED).lte(WAD.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(fxrpAssetId, user2.address))
      .standbyAssetAmount;
    await shutdown.connect(user2).redeemCollateral(fxrpAssetId);
    after = (await vaultEngine.vaults(fxrpAssetId, user2.address))
      .standbyAssetAmount;

    // redemption ratio * stablecoin returned
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

    before = await reserve.vouchers(user2.address);
    await shutdown.connect(user2).redeemVouchers();
    after = await reserve.vouchers(user2.address);
    const EXPECTED_IOU_BALANCE_CHANGE = DEBT_THRESHOLD.div(4);
    expect(before.sub(after)).to.equal(EXPECTED_IOU_BALANCE_CHANGE);
  });

  it("test happy flow where system is insolvent", async () => {
    // set up scenario for insolvent system

    // current collateral ratio: 150%
    // starting price flr: $4.30, fxrp: $6.23
    await ftsoFlr.setCurrentPrice(RAY.mul(43).div(10));
    await priceFeed.updateAdjustedPrice(flrAssetId);
    await ftsoFxrp.setCurrentPrice(RAY.mul(623).div(100));
    await priceFeed.updateAdjustedPrice(fxrpAssetId);

    // have at least 4 vault that is undercollateralized
    await flrWallet
      .connect(user1)
      .deposit({ value: ethers.utils.parseEther("4500") });
    await fxrpDeposit(user1, WAD.mul(1000000));
    await vaultEngine
      .connect(user1)
      .modifyEquity(flrAssetId, treasury.address, WAD.mul(4500), RAD.mul(5000));
    balances.user1.flr = {
      activeAmount: WAD.mul(4500),
      equity: WAD.mul(5000),
    };

    await vaultEngine
      .connect(user1)
      .modifyEquity(
        fxrpAssetId,
        treasury.address,
        WAD.mul(1000000),
        RAD.mul(2000000)
      );
    balances.user1.fxrp = {
      activeAmount: WAD.mul(1000000),
      equity: WAD.mul(2000000),
    };
    await expectBalancesToMatch(user1, balances.user1);

    await flrWallet
      .connect(user2)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await fxrpDeposit(user2, WAD.mul(270000));
    await vaultEngine
      .connect(user2)
      .modifyDebt(flrAssetId, treasury.address, WAD.mul(2300), RAD.mul(6000));
    balances.user2.flr = {
      activeAmount: WAD.mul(2300),
      debt: WAD.mul(6000),
    };
    await vaultEngine
      .connect(user2)
      .modifyDebt(
        fxrpAssetId,
        treasury.address,
        WAD.mul(270000),
        RAD.mul(1100000)
      );
    balances.user2.fxrp = {
      activeAmount: WAD.mul(270000),
      debt: WAD.mul(1100000),
    };
    balances.user2.stablecoin = RAD.mul(6000 + 1100000);
    await expectBalancesToMatch(user2, balances.user2);

    await flrWallet
      .connect(user3)
      .deposit({ value: ethers.utils.parseEther("9000") });
    await vaultEngine
      .connect(user3)
      .modifyDebt(flrAssetId, treasury.address, WAD.mul(9000), RAD.mul(15000));
    await vaultEngine
      .connect(user3)
      .modifyDebt(flrAssetId, treasury.address, WAD.mul(0), RAD.mul(10000));

    balances.user3.flr = {
      activeAmount: WAD.mul(9000),
      debt: WAD.mul(10000 + 15000),
    };
    balances.user3.stablecoin = RAD.mul(15000 + 10000);
    await expectBalancesToMatch(user3, balances.user3);

    await fxrpDeposit(user4, WAD.mul(620000));
    await vaultEngine
      .connect(user4)
      .modifyEquity(
        fxrpAssetId,
        treasury.address,
        WAD.mul(400000),
        RAD.mul(1000000)
      );
    await vaultEngine
      .connect(user4)
      .modifyDebt(
        fxrpAssetId,
        treasury.address,
        WAD.mul(220000),
        RAD.mul(1500000)
      );

    balances.user4.fxrp = {
      activeAmount: WAD.mul(400000 + 220000),
      debt: WAD.mul(1500000),
      equity: WAD.mul(1000000),
    };
    balances.user4.stablecoin = RAD.mul(1500000);
    await expectBalancesToMatch(user4, balances.user4);

    await flrWallet
      .connect(user5)
      .deposit({ value: ethers.utils.parseEther("2000") });
    await fxrpDeposit(user5, WAD.mul(1830000));
    await vaultEngine
      .connect(user5)
      .modifyEquity(flrAssetId, treasury.address, WAD.mul(1000), RAD.mul(1500));
    await vaultEngine
      .connect(user5)
      .modifyDebt(flrAssetId, treasury.address, WAD.mul(1000), RAD.mul(1500));

    balances.user5.flr = {
      activeAmount: WAD.mul(1000 + 1000),
      debt: WAD.mul(1500),
      equity: WAD.mul(1500),
    };

    await vaultEngine
      .connect(user5)
      .modifyEquity(
        fxrpAssetId,
        treasury.address,
        WAD.mul(1830000),
        RAD.mul(1500000)
      );
    await vaultEngine
      .connect(user5)
      .modifyDebt(fxrpAssetId, treasury.address, WAD.mul(0), RAD.mul(1200000));

    balances.user5.fxrp = {
      activeAmount: WAD.mul(1830000),
      debt: WAD.mul(1200000),
      equity: WAD.mul(1500000),
    };
    balances.user5.stablecoin = RAD.mul(1200000 + 1500);
    await expectBalancesToMatch(user5, balances.user5);

    // new collateral ratio: 175%
    // drop prices flr: $3.60, fxrp: $4.48
    await priceFeed.updateLiquidationRatio(flrAssetId, WAD.mul(175).div(100));
    await priceFeed.updateLiquidationRatio(fxrpAssetId, WAD.mul(175).div(100));
    await ftsoFlr.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(360).div(100));
    await priceFeed.updateAdjustedPrice(flrAssetId);
    await ftsoFxrp.setCurrentPrice(RAY.div(RAY).mul(1e5).mul(448).div(100));
    await priceFeed.updateAdjustedPrice(fxrpAssetId);

    // start 2 auction 1 of each collateral

    await liquidator.liquidateVault(flrAssetId, user2.address);
    balances.user2.flr = {
      activeAmount: WAD.mul(0),
      debt: WAD.mul(0),
    };
    reserveBalances.debt = RAD.mul(6000);
    await checkReserveBalances(reserveBalances);

    await liquidator.liquidateVault(fxrpAssetId, user2.address);
    balances.user2.fxrp = {
      activeAmount: WAD.mul(0),
      debt: WAD.mul(0),
    };
    reserveBalances.debt = reserveBalances.debt.add(RAD.mul(1100000));
    await checkReserveBalances(reserveBalances);

    // put system reserve to fill up some gap but not entirely
    await treasury
      .connect(user2)
      .transferStablecoin(reserve.address, WAD.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(7000));
    await checkReserveBalances(reserveBalances);
    balances.user2.stablecoin = balances.user2.stablecoin.sub(RAD.mul(7000));
    await expectBalancesToMatch(user2, balances.user2);

    await treasury
      .connect(user4)
      .transferStablecoin(reserve.address, WAD.mul(140000));

    reserveBalances.reserve = reserveBalances.reserve.add(RAD.mul(140000));
    await checkReserveBalances(reserveBalances);
    balances.user4.stablecoin = balances.user4.stablecoin.sub(RAD.mul(140000));
    await expectBalancesToMatch(user4, balances.user4);

    // initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);

    // drop prices flr: $2.23, fxrp: $2.20
    await ftsoFlr.setCurrentPrice(RAY.mul(223).div(100));
    await ftsoFxrp.setCurrentPrice(RAY.mul(220).div(100));

    // set final prices
    await shutdown.setFinalPrice(flrAssetId);
    expect((await shutdown.assets(flrAssetId)).finalPrice).to.equal(
      RAY.mul(223).div(100)
    );
    await shutdown.setFinalPrice(fxrpAssetId);
    expect((await shutdown.assets(fxrpAssetId)).finalPrice).to.equal(
      RAY.mul(220).div(100)
    );

    // process debt for flr collateral
    await shutdown.processUserDebt(flrAssetId, user1.address);
    let EXPECTED_FLR_GAP = WAD.mul(0);
    expect((await shutdown.assets(flrAssetId)).gap).to.equal(EXPECTED_FLR_GAP);
    await shutdown.processUserDebt(flrAssetId, user2.address);
    expect((await shutdown.assets(flrAssetId)).gap).to.equal(EXPECTED_FLR_GAP);
    await shutdown.processUserDebt(flrAssetId, user3.address);

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
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    await shutdown.processUserDebt(flrAssetId, user4.address);
    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(flrAssetId, user5.address);
    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // process debt for fxrp collateral
    await shutdown.processUserDebt(fxrpAssetId, user1.address);
    let EXPECTED_FXRP_GAP = WAD.mul(0);
    expect((await shutdown.assets(fxrpAssetId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(fxrpAssetId, user2.address);
    expect((await shutdown.assets(fxrpAssetId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(fxrpAssetId, user3.address);
    expect((await shutdown.assets(fxrpAssetId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(fxrpAssetId, user4.address);
    // user 4 have debt of $1500000, coll value: 620000 * 2.20 = 1364000
    // unbackedDebt should be 1500000 - 1364000 = 136000
    // collGap should be 136000 / 2.20 = 61818.1818182
    EXPECTED_FXRP_GAP = WAD.mul("618181818182").div(1e7);
    EXPECTED_AUR_GAP = EXPECTED_AUR_GAP.add(RAD.mul(136000));
    expect(
      (await shutdown.unbackedDebt())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(fxrpAssetId, user5.address);

    expect(
      (await shutdown.unbackedDebt())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(RAD.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to settle system debt
    await reserve.settle(RAD.mul(147000));

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();
    const EXPECTED_FINAL_DEBT_BALANCE = RAD.mul(3685500);
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
    await shutdown.processUserEquity(flrAssetId, user1.address);
    // user 1 has supplied $5000, 0.85043825585 = 4252.19127925 on hook
    // supplied amount * supplier obligation ratio
    // 4252.19127925  * 0.0382390449 = 162.599733251
    // coll amount = 162.599733251 / 2.23 = 72.9146785877
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(WAD.mul("729146785877").div(1e10));
    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(flrAssetId, user2.address);
    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    await shutdown.processUserEquity(flrAssetId, user3.address);
    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(flrAssetId, user4.address);
    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(flrAssetId, user5.address);

    // user5 supplied $1500 * 0.85043825585 = 1275.65738377
    // 1275.65738377 * 0.0382390449 = 48.779919975
    // 48.779919975 / 2.23 = 21.8744035762
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(WAD.mul("218744035762").div(1e10));

    expect(
      (await shutdown.assets(flrAssetId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // process supplier for fxrp collateral
    await shutdown.processUserEquity(fxrpAssetId, user1.address);
    // user1 supplied $2000000 * 0.85043825585 = 1700876.5117
    // 1700876.5117 * 0.0382390449 = 65039.8933003
    // 65039.8933003 / 2.20 = 29563.5878638
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(WAD.mul("295635878638").div(1e7));
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(fxrpAssetId, user2.address);
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(fxrpAssetId, user3.address);
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);
    await shutdown.processUserEquity(fxrpAssetId, user4.address);
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // user5 supplied $1500000 * 0.85043825585 = 1275657.38377
    // 1275657.38377 * 0.0382390449 = 48779.919975
    // 48779.919975 / 2.20 = 22172.6908977
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(WAD.mul("221726908977").div(1e7));

    await shutdown.processUserEquity(fxrpAssetId, user5.address);
    expect(
      (await shutdown.assets(fxrpAssetId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(WAD.div(10))
    ).to.equal(true);

    // increase time by 2 days
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // calcuate redemption ratio
    await shutdown.calculateRedemptionRatio(flrAssetId);
    // redemption ratio = theoretical max - gap / total stablecoin in circulation
    // ((26500 / $2.23) - 2115.9732496600 / $3685500
    // 11883.4080717 - 2063.5106908794 = 9767.43482209
    // 9767.43482209 / 3685500 = 0.00265023329

    const EXPECTED_FLR_REDEMPTION_RATIO = RAY.mul("265023329").div(1e11);
    expect(
      (await shutdown.assets(flrAssetId)).redemptionRatio
        .sub(EXPECTED_FLR_REDEMPTION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    await shutdown.calculateRedemptionRatio(fxrpAssetId);
    // redemption ratio = theoretical max - gap / total stablecoin in circulation
    // ((2700000 / $2.20) - 10081.9030487 / $3685500
    // 1227272.72727 - 10081.9030487 = 1217190.82422
    // 1217190.82422 / $3685500 = 0.3302647739
    const EXPECTED_FXRP_REDEMPTION_RATIO = RAY.mul("3302647739").div(1e10);

    expect(
      (await shutdown.assets(fxrpAssetId)).redemptionRatio
        .sub(EXPECTED_FXRP_REDEMPTION_RATIO)
        .abs()
        .lte(WAD.div(100))
    ).to.equal(true);

    // return stablecoin
    await shutdown.connect(user2).returnStablecoin(RAD.mul(1099000));
    expect(await shutdown.stablecoin(user2.address)).to.equal(RAD.mul(1099000));

    // redeem collateral
    let before = (await vaultEngine.vaults(flrAssetId, user2.address))
      .standbyAssetAmount;
    await shutdown.connect(user2).redeemCollateral(flrAssetId);
    let after = (await vaultEngine.vaults(flrAssetId, user2.address))
      .standbyAssetAmount;
    // user2 stablecoin balance: 1099000
    // stablecoin balance * flr Redeemed Collateral
    // 1099000 * 0.00265023329 = 2912.60638571
    const EXPECTED_FLR_COLL_REDEEMED = WAD.mul("291260638571").div(1e8);
    expect(
      after.sub(before).sub(EXPECTED_FLR_COLL_REDEEMED).abs().lte(WAD.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(fxrpAssetId, user2.address))
      .standbyAssetAmount;
    await shutdown.connect(user2).redeemCollateral(fxrpAssetId);
    after = (await vaultEngine.vaults(fxrpAssetId, user2.address))
      .standbyAssetAmount;
    // user2 stablecoin balance: 1099000
    // stablecoin balance * flr Redeemed Collateral
    // 1099000 * 0.3302647739 = 362960.986516
    const EXPECTED_FXRP_COLL_REDEEMED = WAD.mul("362960986516").div(1e6);
    expect(
      after.sub(before).sub(EXPECTED_FXRP_COLL_REDEEMED).abs().lte(WAD.div(100))
    ).to.equal(true);
  });
});
