import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import {
  Aurei,
  Erc20Collateral,
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
  MockErc20Token,
  Shutdown,
} from "../typechain";
import { ethers, web3 } from "hardhat";
import fundFlr from "./utils/fundFlr";
import * as chai from "chai";
import { deployTest, mock, probity } from "../lib/deployer";
import increaseTime from "./utils/increaseTime";
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
let fxrpColl: Erc20Collateral;
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

const PRECISION_COLL = ethers.BigNumber.from("1000000000000000000");
const PRECISION_PRICE = ethers.BigNumber.from("1000000000000000000000000000");
const PRECISION_AUR = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

const COLL_AMOUNT = PRECISION_COLL.mul(1000);
const SUPPLY_COLL_AMOUNT = PRECISION_COLL.mul(800);
const SUPPLY_AMOUNT = PRECISION_COLL.mul(400);
const LOAN_COLL_AMOUNT = PRECISION_COLL.mul(200);
const LOAN_AMOUNT = PRECISION_COLL.mul(100);

let flrCollId = web3.utils.keccak256("FLR");
let fxrpCollId = web3.utils.keccak256("FXRP");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function getUservaultEngine(
  vaultEngineContract: VaultEngine,
  collId: string,
  user: any
) {
  const vaultEngine = await vaultEngineContract.vaults(collId, user.address);

  const simplifiedvaultEngine = {
    freeColl: vaultEngine[0].toString(),
    lockedColl: vaultEngine[1].toString(),
    debt: vaultEngine[2].toString(),
    supplied: vaultEngine[3].toString(),
  };
  // console.table(simplifiedvaultEngine)

  return simplifiedvaultEngine;
}

async function calculateCollRequirements(
  contracts: any,
  collId: string,
  user: any
) {
  // get vaultEngine debt accumulator
  const { debtAccumulator } = await contracts.vaultEngine.collateralTypes(
    collId
  );
  // get user debt
  const { debt } = await getUservaultEngine(
    contracts.vaultEngine,
    collId,
    user
  );
  const { _price: price } = await contracts.ftso.getCurrentPrice();
  return ethers.BigNumber.from(debt).mul(debtAccumulator).div(price);
}

async function getShutdownState({
  shutdown,
  colls = [
    { name: "fxrp", id: fxrpCollId },
    { name: "flr", id: flrCollId },
  ],
  users = {},
}: {
  shutdown?: Shutdown;
  colls?: any;
  users?: any;
}) {
  const initiated = await shutdown.initiated();
  const initiatedAt = await shutdown.initiatedAt();
  const finalAurUtilizationRatio = await shutdown.finalAurUtilizationRatio();
  const redeemRatio = await shutdown.redeemRatio();
  const aurGap = await shutdown.aurGap();
  const supplierObligationRatio = await shutdown.supplierObligationRatio();
  const debt = await shutdown.debt();
  const collTypes = {};

  for (let coll of colls) {
    console.log(coll);
    const collType = await shutdown.collateralTypes(coll.id);
    console.log(collTypes);
    collTypes[coll.name] = {
      finalPrice: collType.finalPrice,
      gap: collType.gap,
      redeemRatio: collType.redeemRatio,
    };
  }

  const output = {
    initiated,
    initiatedAt: initiatedAt.toString(),
    finalAurUtilizationRatio: finalAurUtilizationRatio.toString(),
    finalAurUtilizationPercentage: (
      finalAurUtilizationRatio.mul(10000).div(PRECISION_PRICE).toNumber() / 100
    ).toFixed(2),
    redeemRatio: redeemRatio.toString(),
    aurGap: aurGap.toString(),
    supplierObligationRatio: supplierObligationRatio.toString(),
    debt: debt.toString(),
  };

  // console.table(output)
  // console.table(collTypes)

  return { state: output, collTypes };
}

async function fxrpDeposit(user, amount) {
  await erc20.mint(user.address, amount);
  await erc20.connect(user).approve(fxrpColl.address, amount);
  await fxrpColl.connect(user).deposit(amount);
}

describe.only("Shutdown Flow Test", function () {
  const TWO_DAYS_IN_SECONDS = 172800;
  const DEBT_THRESHOLD = PRECISION_AUR.mul(5000);
  beforeEach(async function () {
    let { contracts, signers } = await deployTest();

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    flrColl = contracts.nativeCollateral;
    fxrpColl = contracts.fxrpCollateral;
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    ftsoFlr = contracts.ftso;
    priceFeed = contracts.priceFeed;
    auctioneerFlr = contracts.auctioneer;
    liquidator = contracts.liquidator;
    reserve = contracts.reserve;
    registry = contracts.registry;
    erc20 = contracts.erc20;
    shutdown = contracts.shutdown;

    contracts = await mock.deployMockFtso();
    ftsoFxrp = contracts.ftso;

    contracts = await probity.deployAuction();
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
    await teller.initCollType(flrCollId);
    await priceFeed.init(flrCollId, PRECISION_COLL.mul(150), ftsoFlr.address);
    await liquidator.init(flrCollId, auctioneerFlr.address);

    await vaultEngine.initCollType(fxrpCollId);
    await vaultEngine.updateCeiling(fxrpCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(fxrpCollId);
    await priceFeed.init(fxrpCollId, PRECISION_COLL.mul(150), ftsoFxrp.address);
    await liquidator.init(fxrpCollId, auctioneerFxrp.address);
    await reserve.updateDebtThreshold(DEBT_THRESHOLD);
  });

  it.only("test happy flow where system is solvent", async () => {
    // set up scenario for solvent system

    // current collateral ratio : 150%
    // starting price flr : $1.10 , fxrp : $2.78

    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(11).div(10));
    await priceFeed.updatePrice(flrCollId);
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(278).div(100));
    await priceFeed.updatePrice(fxrpCollId);

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
    await vaultEngine
      .connect(user1)
      .modifySupply(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(1000000),
        PRECISION_COLL.mul(300000)
      );

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
    console.log(
      "treasury balance         ",
      (await vaultEngine.aur(treasury.address)).toString()
    );
    await vaultEngine
      .connect(user2)
      .modifyDebt(
        fxrpCollId,
        treasury.address,
        PRECISION_COLL.mul(270000),
        PRECISION_COLL.mul(135000)
      );

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

    // drop prices flr : : $0.60 , fxrp: $1.23
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(60).div(100));
    await priceFeed.updatePrice(flrCollId);
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(123).div(100));
    await priceFeed.updatePrice(fxrpCollId);
    // start 2 auction 1 of each collateral

    await liquidator.liquidateVault(flrCollId, user2.address);
    await liquidator.liquidateVault(fxrpCollId, user2.address);

    // increase system debt and do IOU sale to have some iou balances
    await reserve.increaseSystemDebt(DEBT_THRESHOLD.mul(12).div(10));
    await reserve.sendAurei(user2.address, DEBT_THRESHOLD.mul(12).div(10));
    await reserve.startIouSale();
    await reserve.connect(user3).buyIou(DEBT_THRESHOLD.mul(3).div(4));
    await reserve.connect(user2).buyIou(DEBT_THRESHOLD.div(4));

    // put system reserve (enough to cover all the debt have have extra left over) and have IOU holder
    await treasury
      .connect(user2)
      .transferAurei(reserve.address, PRECISION_COLL.mul(7000));
    await treasury
      .connect(user3)
      .transferAurei(reserve.address, PRECISION_COLL.mul(140000));

    // initiate shutdown
    await shutdown.initiateShutdown();

    // drop prices flr : : $0.42 , fxrp: $1.03
    await ftsoFlr.setCurrentPrice(PRECISION_PRICE.mul(42).div(100));
    await ftsoFxrp.setCurrentPrice(PRECISION_PRICE.mul(103).div(100));

    // set final prices
    await shutdown.setFinalPrice(flrCollId);
    await shutdown.setFinalPrice(fxrpCollId);

    // process debt for flr collateral
    await shutdown.processUserDebt(flrCollId, user1.address);
    await shutdown.processUserDebt(flrCollId, user2.address);
    await shutdown.processUserDebt(flrCollId, user3.address);
    await shutdown.processUserDebt(flrCollId, user4.address);

    // process debt for fxrp collateral
    await shutdown.processUserDebt(fxrpCollId, user1.address);
    await shutdown.processUserDebt(fxrpCollId, user2.address);
    await shutdown.processUserDebt(fxrpCollId, user3.address);
    await shutdown.processUserDebt(flrCollId, user4.address);

    // cancel some auction
    // await auctioneerFlr.cancelAuction(1, shutdown.address)
    await shutdown.cancelAuction(flrCollId, 1);
    await shutdown.cancelAuction(fxrpCollId, 1);
    // finish others by buying them or debt canceling

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // use the system reserve to settle system debt
    await reserve.settle(PRECISION_AUR.mul(137500));

    await shutdown.calculateSupplierObligation();
    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // console.log("Supplier Obligation Ratio" , (await shutdown.supplierObligationRatio()).toString())
    // console.log("coll gap                 " , (await shutdown.collateralTypes(flrCollId)).gap.toString())
    // console.log("Aur Gap                  " , (await shutdown.aurGap()).toString())
    // console.log("Aur Gap                  " , (await shutdown.aurGap()).toString())
    //
    // console.log("System Reserve           " , (await vaultEngine.aur(reserve.address)).toString())
    // console.log("System Debt              " , (await vaultEngine.unbackedAurei(reserve.address)).toString())

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();
    const res = await shutdown.finalDebtBalance();

    // calcuate redeem ratio
    await shutdown.calculateRedeemRatio(flrCollId);
    await shutdown.calculateRedeemRatio(fxrpCollId);

    // return Aurei
    await shutdown.connect(user2).returnAurei(PRECISION_AUR.mul(65000 + 1500));
    // await shutdown.connect(user3).returnAurei(PRECISION_AUR.mul(100000))

    // redeem collateral
    await shutdown.connect(user2).redeemCollateral(flrCollId);
    await shutdown.connect(user2).redeemCollateral(fxrpCollId);

    // have extra system surplus where Iou holders can redeem collateral based on the aur

    await shutdown.connect(user2).ious;

    console.log(
      "iou balance              ",
      (await reserve.ious(user2.address)).toString()
    );
  });

  it("test happy flow where system is insolvent", async () => {
    // set up scenario for insolvent system

    // set up some auctions
    // @todo figure out how to set up auctions

    // user should have aurei as well

    // initiate shutdown
    await shutdown.initiateShutdown();

    // set final prices
    await shutdown.setFinalPrice(flrCollId);
    await shutdown.setFinalPrice(fxrpCollId);

    // process debt for flr collateral
    await shutdown.processUserDebt(flrCollId, user1.address);
    await shutdown.processUserDebt(flrCollId, user2.address);
    await shutdown.processUserDebt(flrCollId, user3.address);
    await shutdown.processUserDebt(flrCollId, user4.address);

    // process debt for fxrp collateral
    await shutdown.processUserDebt(fxrpCollId, user1.address);
    await shutdown.processUserDebt(fxrpCollId, user2.address);
    await shutdown.processUserDebt(fxrpCollId, user3.address);
    await shutdown.processUserDebt(fxrpCollId, user4.address);

    // cancel some auction

    // finish others by buying them or debt canceling

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // calculate supplier obligation
    await shutdown.calculateSupplierObligation();

    // process supply side flr collateral
    await shutdown.processUserSupply(flrCollId, user1.address);
    await shutdown.processUserSupply(flrCollId, user2.address);
    await shutdown.processUserSupply(flrCollId, user3.address);
    await shutdown.processUserSupply(flrCollId, user4.address);

    // process supply side for fxrp collateral
    await shutdown.processUserSupply(fxrpCollId, user1.address);
    await shutdown.processUserSupply(fxrpCollId, user2.address);
    await shutdown.processUserSupply(fxrpCollId, user3.address);
    await shutdown.processUserSupply(fxrpCollId, user4.address);

    // increaseTime
    await increaseTime(TWO_DAYS_IN_SECONDS);

    // setFinalDebtBalance
    await shutdown.setFinalDebtBalance();

    console.log((await vaultEngine.aur(reserve.address)).toString());
    console.log((await vaultEngine.unbackedAurei(reserve.address)).toString());

    // calcuate redeem ratio
    // await shutdown.calculateRedeemRatio(flrCollId)
    // await shutdown.calculateRedeemRatio(fxrpCollId)

    // return Aurei

    // redeem collateral
  });

  // it("test over collateralized vaultEngines", async () => {
  //   await setUpUserOne(vaultEngine, owner, user1);
  //   await setUpUserTwo(vaultEngine, owner, user2);
  //   await setUpUserThree(vaultEngine, owner, user3);
  //   await setUpUserFour(vaultEngine, owner, user3);
  //
  //   // since all vaultEngines are overCollateralized right now, nothing should change
  //   await shutdown.initiateShutdown();
  //   await shutdown.setFinalPrice(fxrpCollId);
  //   await shutdown.processUserDebt(fxrpCollId, user1.address);
  //   await shutdown.processUserDebt(fxrpCollId, user2.address);
  //   await shutdown.processUserDebt(fxrpCollId, user3.address);
  //   await shutdown.processUserDebt(fxrpCollId, user4.address);
  //   // gap should be zero and supplierObligation should be zero
  //   await increaseTime(TWO_DAYS_IN_SECONDS)
  //   await shutdown.calculateSupplierObligation();
  //
  //   const { state } = await getShutdownState( { shutdown: shutdown });
  //   console.log(state)
  //   expect(state.aurGap).to.equal("0");
  // });
  //
  // it.only("test under collateralized vaultEngines ", async () => {
  //   let uservaultEngine, collRequirement, shutdownState;
  //   await setUpUserOne(vaultEngine, owner, user1);
  //   await setUpUserTwo(vaultEngine, owner, user2);
  //   await setUpUserThree(vaultEngine, owner, user3);
  //   await setUpUserFour(vaultEngine, owner, user4);
  //
  //   // some vaultEngines will be okay, some vaultEngine won't be
  //   await ftso.setCurrentPrice(PRECISION_PRICE.div(4));
  //
  //   // shutdown flow
  //   await shutdown.initiateShutdown();
  //   await shutdown.setFinalPrice(fxrpCollId);
  //   shutdownState = await getShutdownState( { shutdown });
  //   expect(shutdownState.collTypes["fxrp"].gap).to.equal("0");
  //   await shutdown.processUserDebt(fxrpCollId, user1.address);
  //   shutdownState = await getShutdownState( { shutdown });
  //   expect(shutdownState.collTypes["fxrp"].gap).to.equal("0");
  //
  //   await getUservaultEngine(vaultEngine, fxrpCollId, user4);
  //   shutdownState = await getShutdownState( { shutdown });
  //   expect(shutdownState.collTypes["fxrp"].gap).to.equal("0");
  //   collRequirement = await calculateCollRequirements(
  //     { vaultEngine, ftso },
  //     fxrpCollId,
  //     user4
  //   );
  //   uservaultEngine = await getUservaultEngine(vaultEngine, fxrpCollId, user4);
  //   await shutdown.processUserDebt(fxrpCollId, user4.address);
  //
  //   shutdownState = await getShutdownState( { shutdown });
  //   expect(shutdownState.collTypes["fxrp"].gap).to.equal(
  //     collRequirement.sub(uservaultEngine.lockedColl)
  //   );
  // });
  //
  // it("test free excess collateral", async () => {
  //   let uservaultEngine, shutdownState;
  //   await setUpUserOne(vaultEngine, owner, user1);
  //   await setUpUserTwo(vaultEngine, owner, user2);
  //   await setUpUserThree(vaultEngine, owner, user3);
  //   await setUpUserFour(vaultEngine, owner, user4);
  //
  //   let totalDebt = await vaultEngine.totalDebt();
  //   let totalCapital = await vaultEngine.totalCapital();
  //
  //   let expectedUtilitzationRatio = totalDebt
  //     .mul(PRECISION_PRICE)
  //     .add(totalCapital.div(2))
  //     .div(totalCapital);
  //
  //   await shutdown.initiateShutdown();
  //   shutdownState = await getShutdownState( { shutdown });
  //   expect(shutdownState.state.finalAurUtilizationRatio).to.equal(
  //     expectedUtilitzationRatio
  //   );
  //   await shutdown.setFinalPrice(fxrpCollId);
  //
  //   uservaultEngine = await getUservaultEngine(vaultEngine, fxrpCollId, user2);
  //   const lockedCollBefore = uservaultEngine.lockedColl;
  //   const freeableColl = ethers.BigNumber.from(uservaultEngine.lockedColl)
  //     .mul(PRECISION_PRICE)
  //     .sub(
  //       ethers.BigNumber.from(uservaultEngine.supplied).mul(expectedUtilitzationRatio)
  //     )
  //     .div(PRECISION_PRICE);
  //   await shutdown.freeExcessCollateral(fxrpCollId, user2.address);
  //   uservaultEngine = await getUservaultEngine(vaultEngine, fxrpCollId, user2);
  //   expect(
  //     ethers.BigNumber.from(lockedCollBefore)
  //       .sub(ethers.BigNumber.from(uservaultEngine.lockedColl))
  //       .sub(freeableColl)
  //       .toNumber() < 100
  //   ).to.equal(true);
  // });
  //
  // it("test suppliers filled the gap", async () => {
  //   let shutdownState;
  //   await setUpUserOne(vaultEngine, owner, user1);
  //   await setUpUserTwo(vaultEngine, owner, user2);
  //   await setUpUserThree(vaultEngine, owner, user3);
  //   await setUpUserFour(vaultEngine, owner, user4);
  //
  //   await ftso.setCurrentPrice(PRECISION_PRICE.div(4));
  //
  //   await shutdown.initiateShutdown();
  //   await shutdown.setFinalPrice(fxrpCollId);
  //
  //   await shutdown.processUserDebt(fxrpCollId, user1.address);
  //   await shutdown.processUserDebt(fxrpCollId, user3.address);
  //   await shutdown.processUserDebt(fxrpCollId, user4.address);
  //
  //   shutdownState = await getShutdownState( { shutdown });
  // });
  //
  // it("test return aurei and redeem collateral", async () => {});
  //
  // it("test suppliers does not fill the gap", async () => {
  //   // test requirements
  //   // - suppliers doesn't fill the gap
  //   // - have auction running (at least 1)
  //   // - no auction running
  //   // - have reserve pool surplus enough to fill the gap
  //   // - have reserve pool surplus not enough to fill the gap
  //   // - have system debt
  //   // - redeem collateral ratio
  // });
  //
  // it("test auction running", async () => {
  //   // test requirements
  //   // - have auction running (at least 1)
  //   // - no auction running
  //   // - have reserve pool surplus enough to fill the gap
  //   // - have reserve pool surplus not enough to fill the gap
  //   // - have system debt
  //   // - redeem collateral ratio
  // });
  //
  // it("test reserve pool surplus enough to fill the gap", async () => {
  //   // test requirements
  //   // - have reserve pool surplus enough to fill the gap
  //   // - have reserve pool surplus not enough to fill the gap
  //   // - have system debt
  //   // - redeem collateral ratio
  // });
  //
  // it("test reserve pool surplus not enough to fill the gap", async () => {
  //   // test requirements
  //   // - have reserve pool surplus not enough to fill the gap
  //   // - have system debt
  //   // - redeem collateral ratio
  // });
  //
  // it("test system debt ", async () => {
  //   // test requirements
  //   // - have system debt
  // });
});
