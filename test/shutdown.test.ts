import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";

import {
  Aurei,
  Erc20Collateral,
  Vault,
  NativeCollateral,
  Teller,
  Treasury,
  Ftso,
  PriceFeed,
  Auctioneer,
  Liquidator,
  ReservePool,
  Registry,
  Erc20Token,
  Shutdown,
} from "../typechain";
import { deployProbity, getSigners } from "../lib/deploy";
import { ethers, web3 } from "hardhat";
import fundFlr from "./utils/fundFlr";
import * as chai from "chai";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let user3: SignerWithAddress;
let user4: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vault: Vault;
let registry: Registry;
let flrColl: NativeCollateral;
let fxrpColl: Erc20Collateral;
let teller: Teller;
let treasury: Treasury;
let ftso: Ftso;
let priceFeed: PriceFeed;
let auctioneer: Auctioneer;
let liquidator: Liquidator;
let reserve: ReservePool;
let erc20: Erc20Token;
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

let flrCollId = web3.utils.keccak256("FLR Collateral");
let fxrpCollId = web3.utils.keccak256("FXRP Collateral");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

async function getUserVault(vaultContract: Vault, collId: string, user: any) {
  const vault = await vaultContract.vaults(collId, user.address);

  const simplifiedVault = {
    freeColl: vault[0].toString(),
    lockedColl: vault[1].toString(),
    debt: vault[2].toString(),
    supplied: vault[3].toString(),
  };
  // console.table(simplifiedVault)

  return simplifiedVault;
}

async function calculateCollRequirements(
  contracts: any,
  collId: string,
  user: any
) {
  // get vault debt accumulator
  const { debtAccu } = await contracts.vault.collTypes(collId);
  // get user debt
  const { debt } = await getUserVault(contracts.vault, collId, user);
  const { _price: price } = await contracts.ftso.getCurrentPrice();
  return ethers.BigNumber.from(debt).mul(debtAccu).div(price);
}

async function getShutdownState(
  shutdownContract: Shutdown,
  colls: any,
  users: any
) {
  const initiated = await shutdownContract.initiated();
  const initiatedAt = await shutdownContract.initiatedAt();
  const finalAurUtilizationRatio = await shutdownContract.finalAurUtilizationRatio();
  const redeemRatio = await shutdownContract.redeemRatio();
  const aurGap = await shutdownContract.aurGap();
  const supplierObligationRatio = await shutdownContract.supplierObligationRatio();
  const debt = await shutdownContract.debt();
  const collTypes = {};

  for (let coll of colls) {
    const collType = await shutdownContract.collTypes(coll.id);
    collTypes[coll.name] = {
      finalPrice: collType[0].toString(),
      finalPriceRetrievalTime: collType[1].toString(),
      gap: collType[2].toString(),
      redeemRatio: collType[3].toString(),
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

// user 1 both supplier and debtor
// user 1 deposit: 4000 fxrp
// user 1 supply: $1500, using 2500 as coll
// user 1 debt: $500, using 1500 as coll

async function setUpUserOne(vault: any, owner: any, user: any) {
  await erc20.mint(user.address, PRECISION_COLL.mul(4000));
  await erc20.connect(user).approve(fxrpColl.address, PRECISION_COLL.mul(4000));

  await fxrpColl.connect(user).deposit(PRECISION_COLL.mul(4000));

  await vault
    .connect(user)
    .modifySupply(
      fxrpCollId,
      treasury.address,
      PRECISION_COLL.mul(2500),
      PRECISION_COLL.mul(1500)
    );

  await vault
    .connect(user)
    .modifyDebt(
      fxrpCollId,
      treasury.address,
      PRECISION_COLL.mul(1500),
      PRECISION_COLL.mul(500)
    );
}

// user2 supplier
// user 2 deposit 7500 fxrp
// user 2 supply: $3000 using 6000 as coll

async function setUpUserTwo(vault: any, owner: any, user: any) {
  await erc20.mint(user.address, PRECISION_COLL.mul(7500));
  await erc20.connect(user).approve(fxrpColl.address, PRECISION_COLL.mul(7500));
  await fxrpColl.connect(user).deposit(PRECISION_COLL.mul(7500));

  await vault
    .connect(user)
    .modifySupply(
      fxrpCollId,
      treasury.address,
      PRECISION_COLL.mul(6000),
      PRECISION_COLL.mul(3000)
    );
}

// user3 debtor
// user 3 deposit 2300 fxrp
// user 3 debt: 1250 flr with 2000 flr as coll

async function setUpUserThree(vault: any, owner: any, user: any) {
  await erc20.mint(user.address, PRECISION_COLL.mul(2300));
  await erc20.connect(user).approve(fxrpColl.address, PRECISION_COLL.mul(2300));
  await fxrpColl.connect(user).deposit(PRECISION_COLL.mul(2300));

  await vault
    .connect(user)
    .modifyDebt(
      fxrpCollId,
      treasury.address,
      PRECISION_COLL.mul(2300),
      PRECISION_COLL.mul(1250)
    );
}

// user4 debtor and supplier
// user 4 deposit : 13250 fxrp
// user 4 supply : $4000 using 6000 flr as coll
// user 5 debt : $4000 using 6000 flr as coll
async function setUpUserFour(vault: any, owner: any, user: any) {
  await erc20.mint(user.address, PRECISION_COLL.mul(13250));
  await erc20
    .connect(user)
    .approve(fxrpColl.address, PRECISION_COLL.mul(13250));
  await fxrpColl.connect(user).deposit(PRECISION_COLL.mul(13250));

  await vault
    .connect(user)
    .modifySupply(
      fxrpCollId,
      treasury.address,
      PRECISION_COLL.mul(6000),
      PRECISION_COLL.mul(4000)
    );

  await vault
    .connect(user)
    .modifyDebt(
      fxrpCollId,
      treasury.address,
      PRECISION_COLL.mul(6000),
      PRECISION_COLL.mul(4000)
    );
}

describe("Probity Happy flow", function () {
  beforeEach(async function () {
    let { contracts, signers } = await deployProbity();

    // Set contracts
    vault = contracts.vault;
    flrColl = contracts.flrCollateral;
    fxrpColl = contracts.fxrpCollateral;
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    ftso = contracts.ftso;
    priceFeed = contracts.priceFeed;
    auctioneer = contracts.auctioneer;
    liquidator = contracts.liquidator;
    reserve = contracts.reserve;
    registry = contracts.registry;
    erc20 = contracts.erc20;
    shutdown = contracts.shutdown;

    owner = signers.owner;
    user1 = signers.alice;
    user2 = signers.bob;
    user3 = signers.charlie;
    user4 = signers.don;

    await fundFlr(owner, user1.address);
    await fundFlr(owner, user2.address);
    await fundFlr(owner, user3.address);
    await fundFlr(owner, user4.address);

    await vault.initCollType(fxrpCollId);
    await vault.updateCeiling(fxrpCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(fxrpCollId);
    await priceFeed.init(fxrpCollId, PRECISION_COLL.mul(150), ftso.address);
    await priceFeed.updatePrice(fxrpCollId);
  });

  it("test over collateralized vaults", async () => {
    await setUpUserOne(vault, owner, user1);
    await setUpUserTwo(vault, owner, user2);
    await setUpUserThree(vault, owner, user3);
    await setUpUserFour(vault, owner, user3);

    // since all vaults are overCollateralized right now, nothing should change
    await shutdown.initiateShutdown();
    await shutdown.setFinalPrice(fxrpCollId);
    await shutdown.processUserDebt(fxrpCollId, user1.address);
    await shutdown.processUserDebt(fxrpCollId, user2.address);
    await shutdown.processUserDebt(fxrpCollId, user3.address);
    await shutdown.processUserDebt(fxrpCollId, user4.address);
    // gap should be zero and supplierObligation should be zero
    await shutdown.calculateSupplierObligation();

    const { state } = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    expect(state.aurGap).to.equal("0");
  });

  it("test under collateralized vaults ", async () => {
    let userVault, collRequirement, shutdownState;
    await setUpUserOne(vault, owner, user1);
    await setUpUserTwo(vault, owner, user2);
    await setUpUserThree(vault, owner, user3);
    await setUpUserFour(vault, owner, user4);

    // some vaults will be okay, some vault won't be
    await ftso.setCurrentPrice(PRECISION_PRICE.div(4));

    // shutdown flow
    await shutdown.initiateShutdown();
    await shutdown.setFinalPrice(fxrpCollId);
    shutdownState = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    expect(shutdownState.collTypes["fxrp"].gap).to.equal("0");
    await shutdown.processUserDebt(fxrpCollId, user1.address);
    shutdownState = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    expect(shutdownState.collTypes["fxrp"].gap).to.equal("0");

    await getUserVault(vault, fxrpCollId, user4);
    shutdownState = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    expect(shutdownState.collTypes["fxrp"].gap).to.equal("0");
    collRequirement = await calculateCollRequirements(
      { vault, ftso },
      fxrpCollId,
      user4
    );
    userVault = await getUserVault(vault, fxrpCollId, user4);
    await shutdown.processUserDebt(fxrpCollId, user4.address);

    shutdownState = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    expect(shutdownState.collTypes["fxrp"].gap).to.equal(
      collRequirement.sub(userVault.lockedColl)
    );
  });

  it("test free excess collateral", async () => {
    let userVault, shutdownState;
    await setUpUserOne(vault, owner, user1);
    await setUpUserTwo(vault, owner, user2);
    await setUpUserThree(vault, owner, user3);
    await setUpUserFour(vault, owner, user4);

    let totalDebt = await vault.totalDebt();
    let totalSupply = await vault.totalSupply();

    let expectedUtilitzationRatio = totalDebt
      .mul(PRECISION_PRICE)
      .add(totalSupply.div(2))
      .div(totalSupply);

    await shutdown.initiateShutdown();
    shutdownState = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    expect(shutdownState.state.finalAurUtilizationRatio).to.equal(
      expectedUtilitzationRatio
    );
    await shutdown.setFinalPrice(fxrpCollId);

    userVault = await getUserVault(vault, fxrpCollId, user2);
    const lockedCollBefore = userVault.lockedColl;
    console.log(PRECISION_PRICE.toString());
    console.log(expectedUtilitzationRatio.toString());
    const freeableColl = ethers.BigNumber.from(userVault.lockedColl)
      .mul(PRECISION_PRICE)
      .sub(
        ethers.BigNumber.from(userVault.supplied).mul(expectedUtilitzationRatio)
      )
      .div(PRECISION_PRICE);
    await shutdown.freeExcessCollateral(fxrpCollId, user2.address);
    userVault = await getUserVault(vault, fxrpCollId, user2);
    expect(
      ethers.BigNumber.from(lockedCollBefore)
        .sub(ethers.BigNumber.from(userVault.lockedColl))
        .sub(freeableColl)
        .toNumber() < 100
    ).to.equal(true);
    console.log(userVault);
  });

  it.only("test suppliers filled the gap", async () => {
    let shutdownState;
    await setUpUserOne(vault, owner, user1);
    await setUpUserTwo(vault, owner, user2);
    await setUpUserThree(vault, owner, user3);
    await setUpUserFour(vault, owner, user4);

    await ftso.setCurrentPrice(PRECISION_PRICE.div(4));

    await shutdown.initiateShutdown();
    await shutdown.setFinalPrice(fxrpCollId);

    await shutdown.processUserDebt(fxrpCollId, user1.address);
    await shutdown.processUserDebt(fxrpCollId, user3.address);
    await shutdown.processUserDebt(fxrpCollId, user4.address);

    shutdownState = await getShutdownState(
      shutdown,
      [{ name: "fxrp", id: fxrpCollId }],
      []
    );
    console.log(shutdownState);
  });

  it("test return aurei and redeem collateral", async () => {});

  it("test suppliers does not fill the gap", async () => {
    // test requirements
    // - suppliers doesn't fill the gap
    // - have auction running (at least 1)
    // - no auction running
    // - have reserve pool surplus enough to fill the gap
    // - have reserve pool surplus not enough to fill the gap
    // - have system debt
    // - redeem collateral ratio
  });

  it("test auction running", async () => {
    // test requirements
    // - have auction running (at least 1)
    // - no auction running
    // - have reserve pool surplus enough to fill the gap
    // - have reserve pool surplus not enough to fill the gap
    // - have system debt
    // - redeem collateral ratio
  });

  it("test reserve pool surplus enough to fill the gap", async () => {
    // test requirements
    // - have reserve pool surplus enough to fill the gap
    // - have reserve pool surplus not enough to fill the gap
    // - have system debt
    // - redeem collateral ratio
  });

  it("test reserve pool surplus not enough to fill the gap", async () => {
    // test requirements
    // - have reserve pool surplus not enough to fill the gap
    // - have system debt
    // - redeem collateral ratio
  });

  it("test system debt ", async () => {
    // test requirements
    // - have system debt
  });
});
