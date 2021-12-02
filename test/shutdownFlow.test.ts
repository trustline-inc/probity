import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import {
  Aurei,
  ERC20Collateral,
  VaultEngine,
  NativeCollateral,
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
let flrColl: NativeCollateral;
let fxrpColl: ERC20Collateral;
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

const PRECISION_COLL = ethers.BigNumber.from("1000000000000000000");
const PRECISION_PRICE = ethers.BigNumber.from("1000000000000000000000000000");
const PRECISION_AUR = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

let flrCollId = web3.utils.keccak256("FLR");
let fxrpCollId = web3.utils.keccak256("FXRP");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function fxrpDeposit(user, amount) {
  await erc20.mint(user.address, amount);
  await erc20.connect(user).approve(fxrpColl.address, amount);
  await fxrpColl.connect(user).deposit(amount);
}

async function expectBalancesToMatch(user, balance) {
  if (balance.stablecoin !== undefined) {
    let aur = await vaultEngine.stablecoin(user.address);

    expect(aur).to.equal(balance.stablecoin);
  }

  if (balance.flr !== undefined) {
    let vault = await vaultEngine.vaults(flrCollId, user.address);

    if (balance.flr.lockedColl !== undefined) {
      expect(vault.usedCollateral).to.equal(balance.flr.lockedColl);
    }

    if (balance.flr.debt !== undefined) {
      expect(vault.debt).to.equal(balance.flr.debt);
    }
    if (balance.flr.capital !== undefined) {
      expect(vault.capital).to.equal(balance.flr.capital);
    }
  }

  if (balance.fxrp !== undefined) {
    let vault = await vaultEngine.vaults(fxrpCollId, user.address);

    if (balance.fxrp.lockedColl !== undefined) {
      expect(vault.usedCollateral).to.equal(balance.fxrp.lockedColl);
    }

    if (balance.fxrp.debt !== undefined) {
      expect(vault.debt).to.equal(balance.fxrp.debt);
    }
    if (balance.fxrp.capital !== undefined) {
      expect(vault.capital).to.equal(balance.fxrp.capital);
    }
  }
}

async function checkReserveBalances(reserveBalances) {
  expect(await vaultEngine.stablecoin(reserve.address)).to.equal(
    reserveBalances.reserve
  );
  expect(await vaultEngine.unbackedStablecoin(reserve.address)).to.equal(
    reserveBalances.debt
  );
}

describe("Shutdown Flow Test", function () {
  const TWO_DAYS_IN_SECONDS = 172800;
  const DEBT_THRESHOLD = PRECISION_AUR.mul(5000);
  let balances;
  let reserveBalances;
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    flrColl = contracts.nativeCollateral;
    fxrpColl = contracts.erc20Collateral;
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    ftsoFlr = contracts.ftso;
    priceFeed = contracts.priceFeed;
    auctioneerFlr = contracts.auctioneer;
    liquidator = contracts.liquidator;
    reserve = contracts.reservePool;
    registry = contracts.registry;
    erc20 = contracts.erc20Token;
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

    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await priceFeed.init(
      flrCollId,
      PRECISION_COLL.mul(15).div(10),
      ftsoFlr.address
    );
    await liquidator.init(flrCollId, auctioneerFlr.address);

    await vaultEngine.initCollType(fxrpCollId);
    await vaultEngine.updateCeiling(fxrpCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(fxrpCollId, 0);
    await priceFeed.init(
      fxrpCollId,
      PRECISION_COLL.mul(15).div(10),
      ftsoFxrp.address
    );
    await liquidator.init(fxrpCollId, auctioneerFxrp.address);
    await reserve.updateDebtThreshold(DEBT_THRESHOLD);

    balances = {
      user1: { flr: {}, fxrp: {}, aur: PRECISION_COLL.mul(0) },
      user2: { flr: {}, fxrp: {}, aur: PRECISION_COLL.mul(0) },
      user3: { flr: {}, fxrp: {}, aur: PRECISION_COLL.mul(0) },
      user4: { flr: {}, fxrp: {}, aur: PRECISION_COLL.mul(0) },
      user5: { flr: {}, fxrp: {}, aur: PRECISION_COLL.mul(0) },
      user6: { flr: {}, fxrp: {}, aur: PRECISION_COLL.mul(0) },
    };
    reserveBalances = {
      reserve: PRECISION_COLL.mul(0),
      debt: PRECISION_COLL.mul(0),
    };
  });

  it("test happy flow where system is solvent", async () => {
    // set up scenario for solvent system

    // current collateral ratio : 150%
    // starting price flr : $1.10 , fxrp : $2.78
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(11).div(10));
    await priceFeed.updateAdjustedPrice(flrCollId);
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(278).div(100));
    await priceFeed.updateAdjustedPrice(fxrpCollId);

    // have at least 3 vault that is undercollateralized
    await flrColl
      .connect(user1)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await fxrpDeposit(user1, PRECISION_COLL.mul(1000000));
    await vaultEngine
      .connect(user1)
      .modifySupply(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(2300),
        PRECISION_COLL.mul(1000)
      );
    balances.user1.flr = {
      lockedColl: PRECISION_COLL.mul(2300),
      capital: PRECISION_COLL.mul(1000),
    };
    await vaultEngine
      .connect(user1)
      .modifySupply(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(1000000),
        PRECISION_COLL.mul(300000)
      );
    balances.user1.fxrp = {
      lockedColl: PRECISION_COLL.mul(1000000),
      capital: PRECISION_COLL.mul(300000),
    };
    await expectBalancesToMatch(user1, balances.user1);

    await flrColl
      .connect(user2)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await fxrpDeposit(user2, PRECISION_COLL.mul(270000));
    await vaultEngine
      .connect(user2)
      .modifyDebt(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(2300),
        PRECISION_COLL.mul(1500)
      );
    balances.user2.flr = {
      lockedColl: PRECISION_COLL.mul(2300),
      debt: PRECISION_COLL.mul(1500),
    };

    await vaultEngine
      .connect(user2)
      .modifyDebt(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(150000),
        PRECISION_COLL.mul(135000)
      );
    balances.user2.fxrp = {
      lockedColl: PRECISION_COLL.mul(150000),
      debt: PRECISION_COLL.mul(135000),
    };
    balances.user2.stablecoin = PRECISION_AUR.mul(135000 + 1500);
    await expectBalancesToMatch(user2, balances.user2);

    await fxrpDeposit(user3, PRECISION_COLL.mul(600000));
    await vaultEngine
      .connect(user3)
      .modifySupply(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(400000),
        PRECISION_COLL.mul(150000)
      );
    await vaultEngine
      .connect(user3)
      .modifyDebt(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(200000),
        PRECISION_COLL.mul(150000)
      );
    balances.user3.fxrp = {
      lockedColl: PRECISION_COLL.mul(600000),
      debt: PRECISION_COLL.mul(150000),
      capital: PRECISION_COLL.mul(150000),
    };
    balances.user3.stablecoin = PRECISION_AUR.mul(150000);
    await expectBalancesToMatch(user3, balances.user3);

    await flrColl
      .connect(user4)
      .deposit({ value: ethers.utils.parseEther("6900") });
    await vaultEngine
      .connect(user4)
      .modifyDebt(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(6900),
        PRECISION_COLL.mul(4500)
      );
    balances.user4.flr = {
      lockedColl: PRECISION_COLL.mul(6900),
      debt: PRECISION_COLL.mul(4500),
    };
    balances.user4.stablecoin = PRECISION_AUR.mul(4500);
    await expectBalancesToMatch(user4, balances.user4);

    // totalDebt should be $291000
    expect(await vaultEngine.totalDebt()).to.equal(PRECISION_AUR.mul(291000));

    // drop prices flr : : $0.60 , fxrp: $1.23
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(60).div(100));
    await priceFeed.updateAdjustedPrice(flrCollId);
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(123).div(100));
    await priceFeed.updateAdjustedPrice(fxrpCollId);
    // start 2 auction 1 of each collateral
    await liquidator.liquidateVault(flrCollId, user2.address);
    reserveBalances.debt = PRECISION_AUR.mul(1500);
    await checkReserveBalances(reserveBalances);

    await liquidator.liquidateVault(fxrpCollId, user2.address);
    reserveBalances.debt = reserveBalances.debt.add(PRECISION_AUR.mul(135000));
    await checkReserveBalances(reserveBalances);

    balances.user2.flr = {
      lockedColl: PRECISION_COLL.mul(0),
      debt: PRECISION_COLL.mul(0),
    };
    balances.user2.fxrp = {
      lockedColl: PRECISION_COLL.mul(0),
      debt: PRECISION_COLL.mul(0),
    };
    await expectBalancesToMatch(user2, balances.user2);

    // increase system debt and do IOU sale to have some iou balances
    await reserve.increaseSystemDebt(DEBT_THRESHOLD.mul(12).div(10));
    reserveBalances.reserve = DEBT_THRESHOLD.mul(12).div(10);
    reserveBalances.debt = reserveBalances.debt.add(
      DEBT_THRESHOLD.mul(12).div(10)
    );
    await checkReserveBalances(reserveBalances);

    await reserve.sendAurei(user2.address, DEBT_THRESHOLD.mul(12).div(10));
    reserveBalances.reserve = PRECISION_AUR.mul(0);
    await checkReserveBalances(reserveBalances);

    balances.user2.stablecoin = balances.user2.stablecoin.add(
      DEBT_THRESHOLD.mul(12).div(10)
    );
    await expectBalancesToMatch(user2, balances.user2);

    await reserve.startIouSale();
    await reserve.connect(user3).buyIou(DEBT_THRESHOLD.mul(3).div(4));
    reserveBalances.debt = reserveBalances.debt.sub(
      DEBT_THRESHOLD.mul(3).div(4)
    );
    await checkReserveBalances(reserveBalances);

    balances.user3.stablecoin = balances.user3.stablecoin.sub(
      DEBT_THRESHOLD.mul(3).div(4)
    );
    await expectBalancesToMatch(user3, balances.user3);

    await reserve.connect(user2).buyIou(DEBT_THRESHOLD.div(4));
    reserveBalances.debt = reserveBalances.debt.sub(DEBT_THRESHOLD.div(4));
    await checkReserveBalances(reserveBalances);

    balances.user2.stablecoin = balances.user2.stablecoin.sub(
      DEBT_THRESHOLD.div(4)
    );
    await expectBalancesToMatch(user2, balances.user2);

    // put system reserve (enough to cover all the debt have have extra left over) and have IOU holder
    await treasury
      .connect(user2)
      .transferAurei(reserve.address, PRECISION_COLL.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(
      PRECISION_AUR.mul(7000)
    );
    await checkReserveBalances(reserveBalances);
    balances.user2.stablecoin = balances.user2.stablecoin.sub(
      PRECISION_AUR.mul(7000)
    );
    await expectBalancesToMatch(user2, balances.user2);

    await treasury
      .connect(user3)
      .transferAurei(reserve.address, PRECISION_COLL.mul(140000));

    reserveBalances.reserve = reserveBalances.reserve.add(
      PRECISION_AUR.mul(140000)
    );
    await checkReserveBalances(reserveBalances);
    balances.user3.stablecoin = balances.user3.stablecoin.sub(
      PRECISION_AUR.mul(140000)
    );
    await expectBalancesToMatch(user3, balances.user3);

    // initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);

    // drop prices flr : : $0.42 , fxrp: $1.03
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(42).div(100));
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(103).div(100));

    // set final prices
    await shutdown.setFinalPrice(flrCollId);
    expect((await shutdown.collateralTypes(flrCollId)).finalPrice).to.equal(
      PRECISION_PRICE.mul(42).div(100)
    );
    await shutdown.setFinalPrice(fxrpCollId);
    expect((await shutdown.collateralTypes(fxrpCollId)).finalPrice).to.equal(
      PRECISION_PRICE.mul(103).div(100)
    );

    // process debt for flr collateral
    // gap shouldn't change for user1 since user1 only supplied
    await shutdown.processUserDebt(flrCollId, user1.address);

    let EXPECTED_FLR_GAP = "0";
    expect((await shutdown.collateralTypes(flrCollId)).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // gap shouldn't change for user2 since user2's vault is in auction
    await shutdown.processUserDebt(flrCollId, user2.address);

    EXPECTED_FLR_GAP = "0";
    expect((await shutdown.collateralTypes(flrCollId)).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // gap should still be zero because user3 doesn't have flrColl vault
    await shutdown.processUserDebt(flrCollId, user3.address);

    EXPECTED_FLR_GAP = "0";
    expect((await shutdown.collateralTypes(flrCollId)).gap).to.equal(
      EXPECTED_FLR_GAP
    );

    // owed $4500 AUR , value of coll:  69000 flr * $0.42 per collateral = $2898, Aur Gap should be 1602 and coll.gap should be 3814.28571429
    await shutdown.processUserDebt(flrCollId, user4.address);

    EXPECTED_FLR_GAP = "3814285714285714285714";
    let EXPECTED_AUR_GAP = PRECISION_AUR.mul(1602);

    expect((await shutdown.collateralTypes(flrCollId)).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    expect(
      (await shutdown.aurGap()).sub(EXPECTED_AUR_GAP).abs().lte(PRECISION_AUR)
    ).to.equal(true);

    // process debt for fxrp collateral
    await shutdown.processUserDebt(fxrpCollId, user1.address);
    await shutdown.processUserDebt(fxrpCollId, user2.address);
    await shutdown.processUserDebt(fxrpCollId, user3.address);
    await shutdown.processUserDebt(fxrpCollId, user4.address);

    const EXPECTED_FXRP_GAP = 0;

    expect((await shutdown.collateralTypes(fxrpCollId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to settle system debt
    await reserve.settle(PRECISION_AUR.mul(137500));
    reserveBalances.reserve = reserveBalances.reserve.sub(
      PRECISION_AUR.mul(137500)
    );
    reserveBalances.debt = reserveBalances.debt.sub(PRECISION_AUR.mul(137500));
    await checkReserveBalances(reserveBalances);

    await shutdown.fillInAurGap();
    reserveBalances.reserve = reserveBalances.reserve.sub(
      PRECISION_AUR.mul(137500)
    );

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();
    const EXPECTED_FINAL_DEBT_BALANCE = PRECISION_AUR.mul(154500);

    await shutdown.calculateSupplierObligation();

    const EXPECTED_SUPPLIER_OBLIGATION_RATIO = 0;

    expect(await shutdown.supplierObligationRatio()).to.equal(
      EXPECTED_SUPPLIER_OBLIGATION_RATIO
    );

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    expect(await shutdown.finalDebtBalance()).to.equal(
      EXPECTED_FINAL_DEBT_BALANCE
    );

    // calcuate redeem ratio
    await shutdown.calculateRedeemRatio(flrCollId);
    // redeem Ratio = theoretical max - gap / total aur in circulation
    // 10714285714285714285714 - 3814285714285714285714 (6900000000000000000000) / $154500
    // 6900 / $154500 = 0.0446601941

    const EXPECTED_FLR_REDEEM_RATIO = "44660194174757281553398058";
    expect((await shutdown.collateralTypes(flrCollId)).redeemRatio).to.equal(
      EXPECTED_FLR_REDEEM_RATIO
    );

    await shutdown.calculateRedeemRatio(fxrpCollId);
    // redeem Ratio = theoretical max - gap / total aur in circulation
    // 150000 / $1.03 / $154500 = 0.9425959091
    const EXPECTED_FXRP_REDEEM_RATIO = "942595909133754359506077669";
    expect((await shutdown.collateralTypes(fxrpCollId)).redeemRatio).to.equal(
      EXPECTED_FXRP_REDEEM_RATIO
    );

    // return Aurei
    await shutdown.connect(user2).returnAurei(PRECISION_AUR.mul(65000 + 1500));
    expect(await shutdown.stablecoin(user2.address)).to.equal(
      PRECISION_AUR.mul(65000 + 1500)
    );

    // redeem collateral
    let before = (await vaultEngine.vaults(flrCollId, user2.address))
      .freeCollateral;
    await shutdown.connect(user2).redeemCollateral(flrCollId);
    let after = (await vaultEngine.vaults(flrCollId, user2.address))
      .freeCollateral;
    // redeem ratio * aur returned
    // 0.0446601941 * 66500 = 2969.90290765
    const EXPECTED_FLR_COLL_REDEEMED =
      PRECISION_COLL.mul(296990290765).div(1e8);
    // we are okay with up to 0.001 collateral difference
    expect(
      after
        .sub(before)
        .sub(EXPECTED_FLR_COLL_REDEEMED)
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(fxrpCollId, user2.address))
      .freeCollateral;
    await shutdown.connect(user2).redeemCollateral(fxrpCollId);
    after = (await vaultEngine.vaults(fxrpCollId, user2.address))
      .freeCollateral;

    // redeem ratio * aur returned
    // 0.9425959091 * 66500 = 62682.6279552
    const EXPECTED_FXRP_COLL_REDEEMED =
      PRECISION_COLL.mul("626826279552").div(1e7);
    // we are okay with up to 0.001 collateral difference
    expect(
      after
        .sub(before)
        .sub(EXPECTED_FXRP_COLL_REDEEMED)
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    // set finalSystemReserve
    await shutdown.setFinalSystemReserve();
    const EXPECTED_FINAL_TOTAL_RESERVE = PRECISION_AUR.mul(7898);
    expect(
      (await shutdown.finalTotalReserve())
        .sub(EXPECTED_FINAL_TOTAL_RESERVE)
        .abs()
        .lte(PRECISION_AUR.div(100))
    ).to.equal(true);

    before = await reserve.ious(user2.address);
    await shutdown.connect(user2).redeemIou();
    after = await reserve.ious(user2.address);
    const EXPECTED_IOU_BALANCE_CHANGE = DEBT_THRESHOLD.div(4);
    expect(before.sub(after)).to.equal(EXPECTED_IOU_BALANCE_CHANGE);
  });

  it("test happy flow where system is insolvent", async () => {
    // set up scenario for insolvent system

    // current collateral ratio : 150%
    // starting price flr : $4.30 , fxrp : $6.23
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(43).div(10));
    await priceFeed.updateAdjustedPrice(flrCollId);
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(623).div(100));
    await priceFeed.updateAdjustedPrice(fxrpCollId);

    // have at least 4 vault that is undercollateralized
    await flrColl
      .connect(user1)
      .deposit({ value: ethers.utils.parseEther("4500") });
    await fxrpDeposit(user1, PRECISION_COLL.mul(1000000));
    await vaultEngine
      .connect(user1)
      .modifySupply(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(4500),
        PRECISION_COLL.mul(5000)
      );
    balances.user1.flr = {
      lockedColl: PRECISION_COLL.mul(4500),
      capital: PRECISION_COLL.mul(5000),
    };

    await vaultEngine
      .connect(user1)
      .modifySupply(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(1000000),
        PRECISION_COLL.mul(2000000)
      );
    balances.user1.fxrp = {
      lockedColl: PRECISION_COLL.mul(1000000),
      capital: PRECISION_COLL.mul(2000000),
    };
    await expectBalancesToMatch(user1, balances.user1);

    await flrColl
      .connect(user2)
      .deposit({ value: ethers.utils.parseEther("2300") });
    await fxrpDeposit(user2, PRECISION_COLL.mul(270000));
    await vaultEngine
      .connect(user2)
      .modifyDebt(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(2300),
        PRECISION_COLL.mul(6000)
      );
    balances.user2.flr = {
      lockedColl: PRECISION_COLL.mul(2300),
      debt: PRECISION_COLL.mul(6000),
    };
    await vaultEngine
      .connect(user2)
      .modifyDebt(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(270000),
        PRECISION_COLL.mul(1100000)
      );
    balances.user2.fxrp = {
      lockedColl: PRECISION_COLL.mul(270000),
      debt: PRECISION_COLL.mul(1100000),
    };
    balances.user2.stablecoin = PRECISION_AUR.mul(6000 + 1100000);
    await expectBalancesToMatch(user2, balances.user2);

    await flrColl
      .connect(user3)
      .deposit({ value: ethers.utils.parseEther("9000") });
    await vaultEngine
      .connect(user3)
      .modifyDebt(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(9000),
        PRECISION_COLL.mul(15000)
      );
    await vaultEngine
      .connect(user3)
      .modifyDebt(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(0),
        PRECISION_COLL.mul(10000)
      );

    balances.user3.flr = {
      lockedColl: PRECISION_COLL.mul(9000),
      debt: PRECISION_COLL.mul(10000 + 15000),
    };
    balances.user3.stablecoin = PRECISION_AUR.mul(15000 + 10000);
    await expectBalancesToMatch(user3, balances.user3);

    await fxrpDeposit(user4, PRECISION_COLL.mul(620000));
    await vaultEngine
      .connect(user4)
      .modifySupply(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(400000),
        PRECISION_COLL.mul(1000000)
      );
    await vaultEngine
      .connect(user4)
      .modifyDebt(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(220000),
        PRECISION_COLL.mul(1500000)
      );

    balances.user4.fxrp = {
      lockedColl: PRECISION_COLL.mul(400000 + 220000),
      debt: PRECISION_COLL.mul(1500000),
      capital: PRECISION_COLL.mul(1000000),
    };
    balances.user4.stablecoin = PRECISION_AUR.mul(1500000);
    await expectBalancesToMatch(user4, balances.user4);

    await flrColl
      .connect(user5)
      .deposit({ value: ethers.utils.parseEther("2000") });
    await fxrpDeposit(user5, PRECISION_COLL.mul(1830000));
    await vaultEngine
      .connect(user5)
      .modifySupply(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(1000),
        PRECISION_COLL.mul(1500)
      );
    await vaultEngine
      .connect(user5)
      .modifyDebt(
        flrCollId,
        treasury.address,
        PRECISION_COLL.mul(1000),
        PRECISION_COLL.mul(1500)
      );

    balances.user5.flr = {
      lockedColl: PRECISION_COLL.mul(1000 + 1000),
      debt: PRECISION_COLL.mul(1500),
      capital: PRECISION_COLL.mul(1500),
    };

    await vaultEngine
      .connect(user5)
      .modifySupply(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(1830000),
        PRECISION_COLL.mul(1500000)
      );
    await vaultEngine
      .connect(user5)
      .modifyDebt(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(0),
        PRECISION_COLL.mul(1200000)
      );

    balances.user5.fxrp = {
      lockedColl: PRECISION_COLL.mul(1830000),
      debt: PRECISION_COLL.mul(1200000),
      capital: PRECISION_COLL.mul(1500000),
    };
    balances.user5.stablecoin = PRECISION_AUR.mul(1200000 + 1500);
    await expectBalancesToMatch(user5, balances.user5);

    // new collateral ratio : 175%
    // drop prices flr : : $3.60 , fxrp: $4.48
    await priceFeed.updateLiquidationRatio(
      flrCollId,
      PRECISION_COLL.mul(175).div(100)
    );
    await priceFeed.updateLiquidationRatio(
      fxrpCollId,
      PRECISION_COLL.mul(175).div(100)
    );
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(360).div(100));
    await priceFeed.updateAdjustedPrice(flrCollId);
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(448).div(100));
    await priceFeed.updateAdjustedPrice(fxrpCollId);

    // start 2 auction 1 of each collateral

    await liquidator.liquidateVault(flrCollId, user2.address);
    balances.user2.flr = {
      lockedColl: PRECISION_COLL.mul(0),
      debt: PRECISION_COLL.mul(0),
    };
    reserveBalances.debt = PRECISION_AUR.mul(6000);
    await checkReserveBalances(reserveBalances);

    await liquidator.liquidateVault(fxrpCollId, user2.address);
    balances.user2.fxrp = {
      lockedColl: PRECISION_COLL.mul(0),
      debt: PRECISION_COLL.mul(0),
    };
    reserveBalances.debt = reserveBalances.debt.add(PRECISION_AUR.mul(1100000));
    await checkReserveBalances(reserveBalances);

    // put system reserve to fill up some gap but not entirely
    await treasury
      .connect(user2)
      .transferAurei(reserve.address, PRECISION_COLL.mul(7000));

    reserveBalances.reserve = reserveBalances.reserve.add(
      PRECISION_AUR.mul(7000)
    );
    await checkReserveBalances(reserveBalances);
    balances.user2.stablecoin = balances.user2.stablecoin.sub(
      PRECISION_AUR.mul(7000)
    );
    await expectBalancesToMatch(user2, balances.user2);

    await treasury
      .connect(user4)
      .transferAurei(reserve.address, PRECISION_COLL.mul(140000));

    reserveBalances.reserve = reserveBalances.reserve.add(
      PRECISION_AUR.mul(140000)
    );
    await checkReserveBalances(reserveBalances);
    balances.user4.stablecoin = balances.user4.stablecoin.sub(
      PRECISION_AUR.mul(140000)
    );
    await expectBalancesToMatch(user4, balances.user4);

    // initiate shutdown
    await shutdown.initiateShutdown();
    expect(await shutdown.initiated()).to.equal(true);

    // drop prices flr : : $2.23 , fxrp: $2.20
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(223).div(100));
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(220).div(100));

    // set final prices
    await shutdown.setFinalPrice(flrCollId);
    expect((await shutdown.collateralTypes(flrCollId)).finalPrice).to.equal(
      PRECISION_PRICE.mul(223).div(100)
    );
    await shutdown.setFinalPrice(fxrpCollId);
    expect((await shutdown.collateralTypes(fxrpCollId)).finalPrice).to.equal(
      PRECISION_PRICE.mul(220).div(100)
    );

    // process debt for flr collateral
    await shutdown.processUserDebt(flrCollId, user1.address);
    let EXPECTED_FLR_GAP = PRECISION_COLL.mul(0);
    expect((await shutdown.collateralTypes(flrCollId)).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    await shutdown.processUserDebt(flrCollId, user2.address);
    expect((await shutdown.collateralTypes(flrCollId)).gap).to.equal(
      EXPECTED_FLR_GAP
    );
    await shutdown.processUserDebt(flrCollId, user3.address);

    // user 3 have debt of $25000 and have 9000 flr coll @ 2.23 = $20070
    // aurGap should be 25000 - 20070 = 4930
    // collGap should be 4930 / 2.23 = 2210.76233184
    EXPECTED_FLR_GAP = PRECISION_COLL.mul("221076233184").div(1e8);
    let EXPECTED_AUR_GAP = PRECISION_AUR.mul(4930);
    expect(
      (await shutdown.aurGap())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(PRECISION_AUR.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    await shutdown.processUserDebt(flrCollId, user4.address);
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(flrCollId, user5.address);
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    // process debt for fxrp collateral
    await shutdown.processUserDebt(fxrpCollId, user1.address);
    let EXPECTED_FXRP_GAP = PRECISION_COLL.mul(0);
    expect((await shutdown.collateralTypes(fxrpCollId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(fxrpCollId, user2.address);
    expect((await shutdown.collateralTypes(fxrpCollId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(fxrpCollId, user3.address);
    expect((await shutdown.collateralTypes(fxrpCollId)).gap).to.equal(
      EXPECTED_FXRP_GAP
    );

    await shutdown.processUserDebt(fxrpCollId, user4.address);
    // user 4 have debt of $1500000, coll value: 620000 * 2.20 = 1364000
    // aurGap should be 1500000 - 1364000 = 136000
    // collGap should be 136000 / 2.20 = 61818.1818182
    EXPECTED_FXRP_GAP = PRECISION_COLL.mul("618181818182").div(1e7);
    EXPECTED_AUR_GAP = EXPECTED_AUR_GAP.add(PRECISION_AUR.mul(136000));
    expect(
      (await shutdown.aurGap())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(PRECISION_AUR.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);
    await shutdown.processUserDebt(fxrpCollId, user5.address);

    expect(
      (await shutdown.aurGap())
        .sub(EXPECTED_AUR_GAP)
        .abs()
        .lte(PRECISION_AUR.div(100))
    ).to.equal(true);
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to settle system debt
    await reserve.settle(PRECISION_AUR.mul(147000));

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();
    const EXPECTED_FINAL_DEBT_BALANCE = PRECISION_AUR.mul(3685500);
    expect(await shutdown.finalDebtBalance()).to.equal(
      EXPECTED_FINAL_DEBT_BALANCE
    );

    await shutdown.calculateSupplierObligation();

    // total aurGap 140930
    // total capital * final utilization Ratio = total capital in use
    // $4506500 * 0.85043825585 = 3832500
    // total aurGap / total capital in use = supplier obligation ratio
    // 140930 / 3685500 = 0.0382390449

    const EXPECTED_SUPPLIER_OBLIGATION_RATIO =
      PRECISION_COLL.mul("382390449").div(1e10);
    expect(
      (await shutdown.supplierObligationRatio())
        .sub(EXPECTED_SUPPLIER_OBLIGATION_RATIO)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);
    // process supplier for flr collateral
    await shutdown.processUserSupply(flrCollId, user1.address);
    // user 1 has supplied $5000, 0.85043825585 = 4252.19127925 on hook
    // supplied amount * supplier obligation ratio
    // 4252.19127925  * 0.0382390449 = 162.599733251
    // coll amount = 162.599733251 / 2.23 = 72.9146785877
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(
      PRECISION_COLL.mul("729146785877").div(1e10)
    );
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);
    await shutdown.processUserSupply(flrCollId, user2.address);
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);

    await shutdown.processUserSupply(flrCollId, user3.address);
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);
    await shutdown.processUserSupply(flrCollId, user4.address);
    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);
    await shutdown.processUserSupply(flrCollId, user5.address);

    // user5 supplied $1500 * 0.85043825585 = 1275.65738377
    // 1275.65738377 * 0.0382390449 = 48.779919975
    // 48.779919975 / 2.23 = 21.8744035762
    EXPECTED_FLR_GAP = EXPECTED_FLR_GAP.sub(
      PRECISION_COLL.mul("218744035762").div(1e10)
    );

    expect(
      (await shutdown.collateralTypes(flrCollId)).gap
        .sub(EXPECTED_FLR_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);

    // process supplier for fxrp collateral
    await shutdown.processUserSupply(fxrpCollId, user1.address);
    // user1 supplied $2000000 * 0.85043825585 = 1700876.5117
    // 1700876.5117 * 0.0382390449 = 65039.8933003
    // 65039.8933003 / 2.20 = 29563.5878638
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(
      PRECISION_COLL.mul("295635878638").div(1e7)
    );
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);
    await shutdown.processUserSupply(fxrpCollId, user2.address);
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);
    await shutdown.processUserSupply(fxrpCollId, user3.address);
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);
    await shutdown.processUserSupply(fxrpCollId, user4.address);
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);

    // user5 supplied $1500000 * 0.85043825585 = 1275657.38377
    // 1275657.38377 * 0.0382390449 = 48779.919975
    // 48779.919975 / 2.20 = 22172.6908977
    EXPECTED_FXRP_GAP = EXPECTED_FXRP_GAP.sub(
      PRECISION_COLL.mul("221726908977").div(1e7)
    );

    await shutdown.processUserSupply(fxrpCollId, user5.address);
    expect(
      (await shutdown.collateralTypes(fxrpCollId)).gap
        .sub(EXPECTED_FXRP_GAP)
        .abs()
        .lte(PRECISION_COLL.div(10))
    ).to.equal(true);

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // calcuate redeem ratio
    await shutdown.calculateRedeemRatio(flrCollId);
    // redeem Ratio = theoretical max - gap / total aur in circulation
    // ((26500 / $2.23) - 2115.9732496600 / $3685500
    // 11883.4080717 - 2063.5106908794 = 9767.43482209
    // 9767.43482209 / 3685500 = 0.00265023329

    const EXPECTED_FLR_REDEEM_RATIO =
      PRECISION_PRICE.mul("265023329").div(1e11);
    expect(
      (await shutdown.collateralTypes(flrCollId)).redeemRatio
        .sub(EXPECTED_FLR_REDEEM_RATIO)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    await shutdown.calculateRedeemRatio(fxrpCollId);
    // redeem Ratio = theoretical max - gap / total aur in circulation
    // ((2700000 / $2.20) - 10081.9030487 / $3685500
    // 1227272.72727 - 10081.9030487 = 1217190.82422
    // 1217190.82422 / $3685500 = 0.3302647739
    const EXPECTED_FXRP_REDEEM_RATIO =
      PRECISION_PRICE.mul("3302647739").div(1e10);

    expect(
      (await shutdown.collateralTypes(fxrpCollId)).redeemRatio
        .sub(EXPECTED_FXRP_REDEEM_RATIO)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    // return Aurei
    await shutdown.connect(user2).returnAurei(PRECISION_AUR.mul(1099000));
    expect(await shutdown.stablecoin(user2.address)).to.equal(
      PRECISION_AUR.mul(1099000)
    );

    // redeem collateral
    let before = (await vaultEngine.vaults(flrCollId, user2.address))
      .freeCollateral;
    await shutdown.connect(user2).redeemCollateral(flrCollId);
    let after = (await vaultEngine.vaults(flrCollId, user2.address))
      .freeCollateral;
    // user2 aur balance: 1099000
    // aur balance * flr Redeemed Collateral
    // 1099000 * 0.00265023329 = 2912.60638571
    const EXPECTED_FLR_COLL_REDEEMED =
      PRECISION_COLL.mul("291260638571").div(1e8);
    expect(
      after
        .sub(before)
        .sub(EXPECTED_FLR_COLL_REDEEMED)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);

    before = (await vaultEngine.vaults(fxrpCollId, user2.address))
      .freeCollateral;
    await shutdown.connect(user2).redeemCollateral(fxrpCollId);
    after = (await vaultEngine.vaults(fxrpCollId, user2.address))
      .freeCollateral;
    // user2 aur balance: 1099000
    // aur balance * flr Redeemed Collateral
    // 1099000 * 0.3302647739 = 362960.986516
    const EXPECTED_FXRP_COLL_REDEEMED =
      PRECISION_COLL.mul("362960986516").div(1e6);
    expect(
      after
        .sub(before)
        .sub(EXPECTED_FXRP_COLL_REDEEMED)
        .abs()
        .lte(PRECISION_COLL.div(100))
    ).to.equal(true);
  });
});
