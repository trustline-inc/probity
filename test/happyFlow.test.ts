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
} from "../typechain";
import { deployProbity } from "./fixtures/deploy";
import { ethers, web3 } from "hardhat";
import * as chai from "chai";
const expect = chai.expect;

// Wallets
let redeemer: SignerWithAddress;
let owner: SignerWithAddress;
let user: SignerWithAddress;

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

const PRECISION_COLL = ethers.BigNumber.from("1000000000000000000");
const PRECISION_PRICE = ethers.BigNumber.from("1000000000000000000000000000");
const PRECISION_AUR = ethers.BigNumber.from(
  "1000000000000000000000000000000000000000000000"
);

const COLL_AMOUNT = PRECISION_COLL.mul(1000);
const SUPPLY_COLL_AMOUNT = PRECISION_COLL.mul(400);
const SUPPLY_AMOUNT = PRECISION_COLL.mul(200);
const LOAN_COLL_AMOUNT = PRECISION_COLL.mul(200);
const LOAN_AMOUNT = PRECISION_COLL.mul(100);

let flrCollId = web3.utils.keccak256("FLR Collateral");
let fxrpCollId = web3.utils.keccak256("FXRP Collateral");
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);
describe("Probity Happy flow", function () {
  beforeEach(async function () {
    const { contracts, signers } = await deployProbity();

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

    owner = signers.owner;
    user = signers.alice;

    flrCollId = web3.utils.keccak256("FLR Collateral");
  });

  it("test deposit and withdrawal of collateral", async () => {
    const WITHDRAW_AMOUNT = COLL_AMOUNT.div(3);

    // FLR COLLATERAL
    let flrBalBefore = await ethers.provider.getBalance(owner.address);
    let vaultFlrBalBefore = await vault.vaults(flrCollId, owner.address);

    await flrColl.deposit({ value: COLL_AMOUNT });

    let flrBalAfter = await ethers.provider.getBalance(owner.address);
    let vaultFlrBalAfter = await vault.vaults(flrCollId, owner.address);
    expect(flrBalBefore.sub(flrBalAfter) >= COLL_AMOUNT).to.equal(true);
    expect(vaultFlrBalAfter[0].sub(vaultFlrBalBefore[0])).to.equal(COLL_AMOUNT);

    flrBalBefore = await ethers.provider.getBalance(owner.address);
    vaultFlrBalBefore = await vault.vaults(flrCollId, owner.address);

    await flrColl.withdraw(WITHDRAW_AMOUNT);

    flrBalAfter = await ethers.provider.getBalance(owner.address);
    vaultFlrBalAfter = await vault.vaults(flrCollId, owner.address);
    expect(flrBalBefore.sub(flrBalAfter) < WITHDRAW_AMOUNT).to.equal(true);
    expect(vaultFlrBalBefore[0].sub(vaultFlrBalAfter[0])).to.equal(
      WITHDRAW_AMOUNT
    );

    // FXRP COLLATERAL
    await erc20.mint(owner.address, COLL_AMOUNT);
    await erc20.approve(fxrpColl.address, COLL_AMOUNT);

    let fxrpBalBefore = await erc20.balanceOf(owner.address);
    let vaultFxrpBalBefore = await vault.vaults(fxrpCollId, owner.address);

    await fxrpColl.deposit(COLL_AMOUNT);

    let vaultFxrpBalAfter = await vault.vaults(fxrpCollId, owner.address);
    let fxrpBalAfter = await erc20.balanceOf(owner.address);

    expect(fxrpBalBefore.sub(fxrpBalAfter)).to.equal(COLL_AMOUNT);
    expect(vaultFxrpBalAfter[0].sub(vaultFxrpBalBefore[0])).to.equal(
      COLL_AMOUNT
    );

    fxrpBalBefore = await erc20.balanceOf(owner.address);
    vaultFxrpBalBefore = await vault.vaults(fxrpCollId, owner.address);

    await fxrpColl.withdraw(WITHDRAW_AMOUNT);

    vaultFxrpBalAfter = await vault.vaults(fxrpCollId, owner.address);
    fxrpBalAfter = await erc20.balanceOf(owner.address);

    expect(fxrpBalAfter.sub(fxrpBalBefore)).to.equal(WITHDRAW_AMOUNT);
    expect(vaultFxrpBalBefore[0].sub(vaultFxrpBalAfter[0])).to.equal(
      WITHDRAW_AMOUNT
    );
  });

  it("test modifySupply, modifyDebt and AUR withdrawal", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vault.initCollType(flrCollId);
    await vault.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId);
    await priceFeed.init(flrCollId, PRECISION_COLL.mul(150), ftso.address);
    await priceFeed.updatePrice(flrCollId);

    let userVaultBefore = await vault.vaults(flrCollId, owner.address);

    await vault.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );

    let userVaultAfter = await vault.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      SUPPLY_COLL_AMOUNT
    );
    expect(userVaultAfter[3].sub(userVaultBefore[3])).to.equal(SUPPLY_AMOUNT);

    userVaultBefore = await vault.vaults(flrCollId, owner.address);
    let aurBefore = await vault.aur(owner.address);

    await vault.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    let aurAfter = await vault.aur(owner.address);
    expect(aurAfter.sub(aurBefore)).to.equal(LOAN_AMOUNT.mul(PRECISION_PRICE));
    userVaultAfter = await vault.vaults(flrCollId, owner.address);
    expect(userVaultBefore[0].sub(userVaultAfter[0])).to.equal(
      LOAN_COLL_AMOUNT
    );
    expect(userVaultAfter[2].sub(userVaultBefore[2])).to.equal(LOAN_AMOUNT);
  });

  it("test priceFeed Update", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vault.initCollType(flrCollId);
    await vault.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId);
    await priceFeed.init(
      flrCollId,
      PRECISION_PRICE.mul(15).div(10),
      ftso.address
    );

    await priceFeed.updatePrice(flrCollId);

    let collTypeAfter = await vault.collTypes(flrCollId);
    let expectedPrice = PRECISION_PRICE.div(3).mul(2);
    // as long as the expectedPrice is within a buffer, call it success
    expect(collTypeAfter[2].sub(expectedPrice).toNumber() <= 10).to.equal(true);
  });

  it("test liquidation start", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vault.initCollType(flrCollId);
    await vault.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId);
    await liquidator.init(flrCollId, auctioneer.address);
    await priceFeed.init(flrCollId, PRECISION_PRICE, ftso.address);
    await priceFeed.updatePrice(flrCollId);

    await vault.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );
    await vault.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed.updateMinCollRatio(
      flrCollId,
      PRECISION_PRICE.mul(15).div(10)
    );
    await priceFeed.updatePrice(flrCollId);

    let unBackedAurBefore = await vault.unBackedAUR(reserve.address);
    let userVaultBefore = await vault.vaults(flrCollId, owner.address);
    await liquidator.liquidateVault(flrCollId, owner.address);
    let unBackedAurAfter = await vault.unBackedAUR(reserve.address);
    let userVaultAfter = await vault.vaults(flrCollId, owner.address);

    expect(unBackedAurAfter.sub(unBackedAurBefore)).to.equal(
      SUPPLY_AMOUNT.add(LOAN_AMOUNT).mul(PRECISION_PRICE)
    );
    expect(userVaultBefore[1].sub(userVaultAfter[1])).to.equal(
      SUPPLY_COLL_AMOUNT.add(LOAN_COLL_AMOUNT)
    );
  });

  it("test auction process", async () => {
    await flrColl.deposit({ value: COLL_AMOUNT });

    await vault.initCollType(flrCollId);
    await vault.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId);
    await liquidator.init(flrCollId, auctioneer.address);
    await priceFeed.init(flrCollId, PRECISION_PRICE, ftso.address);
    await priceFeed.updatePrice(flrCollId);

    await vault.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );
    await vault.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed.updateMinCollRatio(
      flrCollId,
      PRECISION_PRICE.mul(15).div(10)
    );
    await priceFeed.updatePrice(flrCollId);

    await liquidator.liquidateVault(flrCollId, owner.address);

    const flrCollUser = flrColl.connect(user);
    const vaultUser = vault.connect(user);
    const auctioneerUser = auctioneer.connect(user);
    await flrCollUser.deposit({ value: PRECISION_COLL.mul(3000) });
    await vaultUser.modifySupply(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(2000),
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

    let userVaultBefore = await vault.vaults(flrCollId, user.address);
    let userAurBefore = await vault.aur(user.address);
    await auctioneerUser.buyItNow(
      0,
      PRECISION_PRICE.mul(12).div(10),
      PRECISION_AUR.mul("200")
    );
    let userVaultAfter = await vault.vaults(flrCollId, user.address);
    let userAurAfter = await vault.aur(user.address);
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

    await vault.initCollType(flrCollId);
    await vault.updateCeiling(flrCollId, PRECISION_AUR.mul(10000000));
    await teller.initCollType(flrCollId);
    await liquidator.init(flrCollId, auctioneer.address);
    await priceFeed.init(flrCollId, PRECISION_PRICE, ftso.address);
    await priceFeed.updatePrice(flrCollId);

    await vault.modifySupply(
      flrCollId,
      treasury.address,
      SUPPLY_COLL_AMOUNT,
      SUPPLY_AMOUNT
    );
    await vault.modifyDebt(
      flrCollId,
      treasury.address,
      LOAN_COLL_AMOUNT,
      LOAN_AMOUNT
    );

    await priceFeed.updateMinCollRatio(
      flrCollId,
      PRECISION_PRICE.mul(15).div(10)
    );
    await priceFeed.updatePrice(flrCollId);

    await liquidator.liquidateVault(flrCollId, owner.address);

    const flrCollUser = flrColl.connect(user);
    const vaultUser = vault.connect(user);
    await flrCollUser.deposit({ value: PRECISION_COLL.mul(3000) });
    await vaultUser.modifySupply(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(2000),
      PRECISION_COLL.mul(1000)
    );
    await vaultUser.modifyDebt(
      flrCollId,
      treasury.address,
      PRECISION_COLL.mul(900),
      PRECISION_COLL.mul(600)
    );

    await reserve.updateDebtThreshold(PRECISION_AUR.mul(200));
    await reserve.startIOUSale();

    const reserveUser = reserve.connect(user);
    await ethers.provider.send("evm_increaseTime", [21601]);
    await ethers.provider.send("evm_mine", []);
    await reserveUser.buyIOU(PRECISION_AUR.mul(100));

    let userIOU = await reserve.ious(user.address);
    expect(userIOU > PRECISION_AUR.mul(100)).to.equal(true);
  });
});
