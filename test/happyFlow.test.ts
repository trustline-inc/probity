import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import * as hre from "hardhat";

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
} from "../typechain";
import { deployTest } from "../lib/deployer";
import { ethers, web3 } from "hardhat";
import * as chai from "chai";
const expect = chai.expect;

// Wallets
let owner: SignerWithAddress;
let user: SignerWithAddress;

// Contracts
let aurei: Aurei;
let vaultEngine: VaultEngine;
let registry: Registry;
let flrColl: NativeCollateral;
let fxrpColl: ERC20Collateral;
let teller: Teller;
let treasury: Treasury;
let ftso: MockFtso;
let priceFeed: PriceFeed;
let auctioneer: Auctioneer;
let liquidator: Liquidator;
let reserve: ReservePool;
let erc20: MockERC20Token;

const PRECISION_COLL = ethers.BigNumber.from("1000000000000000000");
const PRECISION_PRICE = ethers.BigNumber.from("1000000000000000000000000000");
const PRECISION_AUR = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

const COLL_AMOUNT = PRECISION_COLL.mul(1000);
const SUPPLY_COLL_AMOUNT = PRECISION_COLL.mul(400);
const SUPPLY_COLL_TO_DECREASE = PRECISION_COLL.mul(-400);
const SUPPLY_AMOUNT_TO_DECREASE = PRECISION_COLL.mul(-200);
const SUPPLY_AMOUNT = PRECISION_COLL.mul(200);
const LOAN_COLL_AMOUNT = PRECISION_COLL.mul(200);
const LOAN_AMOUNT = PRECISION_COLL.mul(100);
const LOAN_REPAY_COLL_AMOUNT = PRECISION_COLL.mul(-200);
const LOAN_REPAY_AMOUNT = PRECISION_COLL.mul(-100);

const flrCollId = web3.utils.keccak256("FLR");
const fxrpCollId = web3.utils.keccak256("FXRP");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

describe("Probity happy flow", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployTest("aurei");

    // Set contracts
    vaultEngine = contracts.vaultEngine;
    flrColl = contracts.nativeCollateral;
    fxrpColl = contracts.erc20Collateral;
    aurei = contracts.aurei;
    teller = contracts.teller;
    treasury = contracts.treasury;
    ftso = contracts.ftso;
    priceFeed = contracts.priceFeed;
    auctioneer = contracts.auctioneer;
    liquidator = contracts.liquidator;
    reserve = contracts.reservePool;
    registry = contracts.registry;
    erc20 = contracts.erc20Token;

    owner = signers.owner;
    user = signers.alice;
  });

  it("test deposit and withdrawal of collateral", async () => {
    const WITHDRAW_AMOUNT = COLL_AMOUNT.div(3);

    // Deposit FLR collateral
    let flrBalBefore = await ethers.provider.getBalance(owner.address);
    let vaultFlrBalBefore = await vaultEngine.vaults(flrCollId, owner.address);

    await flrColl.deposit({ value: COLL_AMOUNT });

    let flrBalAfter = await ethers.provider.getBalance(owner.address);
    let vaultFlrBalAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(flrBalBefore.sub(flrBalAfter) >= COLL_AMOUNT).to.equal(true);
    expect(vaultFlrBalAfter[0].sub(vaultFlrBalBefore[0])).to.equal(COLL_AMOUNT);

    // Withdraw FLR collateral
    flrBalBefore = await ethers.provider.getBalance(owner.address);
    vaultFlrBalBefore = await vaultEngine.vaults(flrCollId, owner.address);

    await flrColl.withdraw(WITHDRAW_AMOUNT);

    flrBalAfter = await ethers.provider.getBalance(owner.address);
    vaultFlrBalAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(flrBalBefore.sub(flrBalAfter) < WITHDRAW_AMOUNT).to.equal(true);
    expect(vaultFlrBalBefore[0].sub(vaultFlrBalAfter[0])).to.equal(
      WITHDRAW_AMOUNT
    );

    // Deposit FXRP collateral
    await erc20.mint(owner.address, COLL_AMOUNT);
    await erc20.approve(fxrpColl.address, COLL_AMOUNT);

    let fxrpBalBefore = await erc20.balanceOf(owner.address);
    let vaultFxrpBalBefore = await vaultEngine.vaults(
      fxrpCollId,
      owner.address
    );

    await fxrpColl.deposit(COLL_AMOUNT);

    let vaultFxrpBalAfter = await vaultEngine.vaults(fxrpCollId, owner.address);
    let fxrpBalAfter = await erc20.balanceOf(owner.address);

    expect(fxrpBalBefore.sub(fxrpBalAfter)).to.equal(COLL_AMOUNT);
    expect(vaultFxrpBalAfter[0].sub(vaultFxrpBalBefore[0])).to.equal(
      COLL_AMOUNT
    );

    // Withdraw FXRP collateral
    fxrpBalBefore = await erc20.balanceOf(owner.address);
    vaultFxrpBalBefore = await vaultEngine.vaults(fxrpCollId, owner.address);

    await fxrpColl.withdraw(WITHDRAW_AMOUNT);

    vaultFxrpBalAfter = await vaultEngine.vaults(fxrpCollId, owner.address);
    fxrpBalAfter = await erc20.balanceOf(owner.address);

    expect(fxrpBalAfter.sub(fxrpBalBefore)).to.equal(WITHDRAW_AMOUNT);
    expect(vaultFxrpBalBefore[0].sub(vaultFxrpBalAfter[0])).to.equal(
      WITHDRAW_AMOUNT
    );
  });

  it("test modifySupply, modifyDebt and aur withdrawal", async () => {
    // Deposit FLR collateral
    await flrColl.deposit({ value: COLL_AMOUNT });

    // Initialize the FLR collateral type
    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await priceFeed.init(
      flrCollId,
      PRECISION_COLL.mul(15).div(10),
      ftso.address
    );
    await priceFeed.updatePrice(flrCollId);

    let userVaultBefore = await vaultEngine.vaults(flrCollId, owner.address);

    // Create Aurei
    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );

    let userVaultAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      SUPPLY_COLL_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(SUPPLY_AMOUNT);

    userVaultBefore = await vaultEngine.vaults(flrCollId, owner.address);
    let aurBefore = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let aurAfter = await vaultEngine.stablecoin(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(LOAN_AMOUNT.mul(PRECISION_PRICE));
    userVaultAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      LOAN_COLL_AMOUNT
    );
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);

    // test aur withdrawal

    let ownerBalanceBefore = await aurei.balanceOf(owner.address);
    await treasury.withdrawAurei(aurAfter.div(PRECISION_PRICE));
    let ownerBalanceAfter = await aurei.balanceOf(owner.address);
    expect(
      ownerBalanceAfter.sub(ownerBalanceBefore).mul(PRECISION_PRICE)
    ).to.equal(aurAfter);
  });

  it("test reducing modifyDebt", async () => {
    // Deposit FLR collateral
    await flrColl.deposit({ value: COLL_AMOUNT });

    // Initialize the FLR collateral type
    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await priceFeed.init(
      flrCollId,
      PRECISION_COLL.mul(15).div(10),
      ftso.address
    );
    await priceFeed.updatePrice(flrCollId);

    // Create Aurei
    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );

    let userVaultBefore = await vaultEngine.vaults(flrCollId, owner.address);
    let aurBefore = await vaultEngine.stablecoin(owner.address);

    // Take out a loan
    await vaultEngine.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let aurAfter = await vaultEngine.stablecoin(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(LOAN_AMOUNT.mul(PRECISION_PRICE));
    let userVaultAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      LOAN_COLL_AMOUNT
    );
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);

    userVaultBefore = await vaultEngine.vaults(flrCollId, owner.address);
    aurBefore = await vaultEngine.stablecoin(owner.address);

    // repay loan
    await vaultEngine.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_REPAY_COLL_AMOUNT,
      LOAN_REPAY_AMOUNT
    );

    aurAfter = await vaultEngine.stablecoin(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(
      LOAN_REPAY_AMOUNT.mul(PRECISION_PRICE)
    );
    userVaultAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      LOAN_REPAY_COLL_AMOUNT
    );
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(
      LOAN_REPAY_AMOUNT
    );
  });

  it("test that modifySupply can be reduced", async () => {
    // Deposit FLR collateral
    await flrColl.deposit({ value: COLL_AMOUNT });

    // Initialize the FLR collateral type
    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await priceFeed.init(
      flrCollId,
      PRECISION_COLL.mul(15).div(10),
      ftso.address
    );
    await priceFeed.updatePrice(flrCollId);

    let userVaultBefore = await vaultEngine.vaults(flrCollId, owner.address);

    // Create Aurei
    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );

    let userVaultAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      SUPPLY_COLL_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(SUPPLY_AMOUNT);

    // test that you can remove the supply
    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_TO_DECREASE,
      SUPPLY_AMOUNT_TO_DECREASE
    );

    let userVaultAfterDecrease = await vaultEngine.vaults(
      flrCollId,
      owner.address
    );
    expect(userVaultAfter[0].sub(userVaultAfterDecrease[0])).to.equal(
      SUPPLY_COLL_TO_DECREASE
    );
    expect(userVaultAfterDecrease[3].sub(userVaultAfter[3])).to.equal(
      SUPPLY_AMOUNT_TO_DECREASE
    );
  });

  it("test priceFeed update", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await priceFeed.init(
      flrCollId,
      PRECISION_COLL.mul(15).div(10),
      ftso.address
    );

    await priceFeed.updatePrice(flrCollId);

    let collTypeAfter = await vaultEngine.collateralTypes(flrCollId);
    let expectedPrice = PRECISION_PRICE.div(3).mul(2);
    // as long as the expectedPrice is within a buffer, call it success
    expect(collTypeAfter[2].sub(expectedPrice).toNumber() <= 10).to.equal(true);
  });

  it("test liquidation start", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await liquidator.init(flrCollId, auctioneer.address);
    await priceFeed.init(flrCollId, PRECISION_COLL, ftso.address);
    await priceFeed.updatePrice(flrCollId);

    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed.updateLiquidationRatio(
      flrCollId,
      PRECISION_COLL.mul(22).div(10)
    );
    await priceFeed.updatePrice(flrCollId);
    let unBackedAurBefore = await vaultEngine.unbackedStablecoin(
      reserve.address
    );
    let userVaultBefore = await vaultEngine.vaults(flrCollId, owner.address);
    await liquidator.liquidateVault(flrCollId, owner.address);
    let unBackedAurAfter = await vaultEngine.unbackedStablecoin(
      reserve.address
    );
    let userVaultAfter = await vaultEngine.vaults(flrCollId, owner.address);
    expect(unBackedAurAfter.sub(unBackedAurBefore)).to.equal(
      SUPPLY_AMOUNT.add(LOAN_AMOUNT).mul(PRECISION_PRICE)
    );
    expect(userVaultBefore[1].sub(userVaultAfter[1])).to.equal(
      SUPPLY_COLL_AMOUNT.add(LOAN_COLL_AMOUNT)
    );
  });

  it("test auction process", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await liquidator.init(flrCollId, auctioneer.address);
    await priceFeed.init(flrCollId, PRECISION_COLL, ftso.address);
    await priceFeed.updatePrice(flrCollId);

    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed.updateLiquidationRatio(
      flrCollId,
      PRECISION_COLL.mul(22).div(10)
    );
    await priceFeed.updatePrice(flrCollId);

    await liquidator.liquidateVault(flrCollId, owner.address);

    const flrCollUser = flrColl.connect(user);
    const vaultUser = vaultEngine.connect(user);
    const auctioneerUser = auctioneer.connect(user);
    await flrCollUser.deposit({ value: PRECISION_COLL.mul(30000) });
    await vaultUser.modifySupply(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(20000),
      PRECISION_COLL.mul(1000)
    );
    await vaultUser.modifyDebt(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(900),
      PRECISION_COLL.mul(600)
    );

    await auctioneerUser.placeBid(
      0,
      PRECISION_PRICE.mul(11).div(10),
      PRECISION_COLL.mul("100")
    );
    let bidAfter = await auctioneer.bids(0, user.address);
    expect(bidAfter[0]).to.equal(PRECISION_PRICE.mul(11).div(10));
    expect(bidAfter[1]).to.equal(PRECISION_COLL.mul("100"));

    let userVaultBefore = await vaultEngine.vaults(flrCollId, user.address);
    let userAurBefore = await vaultEngine.stablecoin(user.address);
    await auctioneerUser.buyItNow(
      0,
      PRECISION_PRICE.mul(12).div(10),
      PRECISION_AUR.mul("200")
    );
    let userVaultAfter = await vaultEngine.vaults(flrCollId, user.address);
    let userAurAfter = await vaultEngine.stablecoin(user.address);
    let expectedLot = PRECISION_AUR.mul("200").div(
      PRECISION_PRICE.mul(12).div(10)
    );
    expect(userAurBefore.sub(userAurAfter)).to.equal(PRECISION_AUR.mul("200"));
    expect(
      userVaultAfter[0].sub(userVaultBefore[0]).sub(expectedLot).toNumber() <=
        1e17
    ).to.equal(true);
  });

  it("test reserve pool settlement + IOU sale", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vaultEngine.initCollType(flrCollId);
    await vaultEngine.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId, 0);
    await liquidator.init(flrCollId, auctioneer.address);
    await priceFeed.init(flrCollId, PRECISION_COLL, ftso.address);
    await priceFeed.updatePrice(flrCollId);

    await vaultEngine.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );
    await vaultEngine.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed.updateLiquidationRatio(
      flrCollId,
      PRECISION_COLL.mul(22).div(10)
    );
    await priceFeed.updatePrice(flrCollId);

    await liquidator.liquidateVault(flrCollId, owner.address);

    const flrCollUser = flrColl.connect(user);
    const vaultUser = vaultEngine.connect(user);
    await flrCollUser.deposit({ value: PRECISION_COLL.mul(30000) });
    await vaultUser.modifySupply(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(20000),
      PRECISION_COLL.mul(1000)
    );

    await vaultUser.modifyDebt(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(900),
      PRECISION_COLL.mul(600)
    );

    await reserve.updateDebtThreshold(PRECISION_AUR.mul(200));
    await reserve.startIouSale();

    const reserveUser = reserve.connect(user);
    await ethers.provider.send("evm_increaseTime", [21601]);
    await ethers.provider.send("evm_mine", []);
    await reserveUser.buyIou(PRECISION_AUR.mul(100));

    let userIOU = await reserve.ious(user.address);
    expect(userIOU > PRECISION_AUR.mul(100)).to.equal(true);
  });
});
