import "@nomiclabs/hardhat-waffle";
import { ethers } from "hardhat";
// We import Chai to use its asserting functions here.
import { expect } from "chai";

// `describe` is a Mocha function that allows you to organize your tests. It's
// not actually needed, but having your tests organized makes debugging them
// easier. All Mocha functions are available in the global scope.

// `describe` receives the name of a section of your test suite, and a callback.
// The callback must define the tests of that section. This callback can't be
// an async function.
describe("Aurie contract", function() {
  // Mocha has four functions that let you hook into the the test runner's
  // lifecyle. These are: `before`, `beforeEach`, `after`, `afterEach`.

  // They're very useful to setup the environment for tests, and to clean it
  // up after they run.

  // A common pattern is to declare some variables, and assign them in the
  // `before` and `beforeEach` callbacks.

  let Teller;
  let teller;
  let Treasury;
  let treasury;
  let Aurei;
  let aurei;
  let owner;
  let aureiTokenOwnerAddress;
  let addr1;
  let addr2;
  let addrs;
  
  before(async function () {
    // Get the ContractFactory and Signers here.
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    
    Teller = await ethers.getContractFactory("Teller");
    teller = await Teller.deploy();
    await teller.deployed();

    Aurei = await ethers.getContractFactory("Aurei");
    //aureiTokenOwnerAddress = teller.address;
    aureiTokenOwnerAddress = owner.address;
    aurei = await Aurei.deploy(aureiTokenOwnerAddress);
    await aurei.deployed();
    
    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(aurei.address);
    await treasury.deployed();
    
  });
  describe("Deployment", function () {
    // `it` is another Mocha function. This is the one you use to define your
    // tests. It receives the test name, and a callback function.

    // If the callback function is async, Mocha will `await` it.
    it("Should set the right owner", async function () {
      // Expect receives a value, and wraps it in an Assertion object. These
      // objects have a lot of utility methods to assert values.
      expect(await aurei.owner()).to.equal(aureiTokenOwnerAddress);
    });

    it("Total supply of the token must be 0", async function () {
      expect(await aurei.totalSupply()).to.equal(0);
    });
    
    it("Owner Balance of the token must be equal to total supply", async function () {
      const ownerBalance = await aurei.balanceOf(aureiTokenOwnerAddress);
      expect(await aurei.totalSupply()).to.equal(ownerBalance);
    });
  });
  
  describe("Transactions", function () {
    it("Minting new tokens and verify owner balance and token supply", async function () {
      await treasury.mint(100);
      const ownerBalance = await aurei.balanceOf(aureiTokenOwnerAddress);
      expect(ownerBalance).to.equal(100);
      expect(await aurei.totalSupply()).to.equal(100);
    });
    it("Burning Tokens and verify owner balance and token supply", async function () {
      await treasury.burn(20);
      const ownerBalance = await aurei.balanceOf(aureiTokenOwnerAddress);
      expect(ownerBalance).to.equal(80);
      expect(await aurei.totalSupply()).to.equal(80);
    });
    it("Transfer tokens to another address", async function () {
      await aurei.transfer(addr1.address, 20);
      expect(await aurei.balanceOf(addr1.address)).to.equal(20);
    });
  });   
});
