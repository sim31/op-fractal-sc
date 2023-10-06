import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { ethers, upgrades } from "hardhat";
import { PeriodicRespect, PeriodicRespect__factory } from "../typechain-types";
import { BigNumberish } from "ethers";
import { type TokenIdDataStruct, packTokenId, unpackTokenId, tokenIdDataEq, normTokenIdData } from "../utils/tokenId";
import { checkConsistencyOfBalance, checkConsistencyOfSupply } from "./consistencyChecks";

chai.use(chaiSubset);

export async function deployImpl() {
  // Contracts are deployed using the first signer/account by default
  const signers = await ethers.getSigners();

  const implOwner = signers[0]!;

  const factory = await ethers.getContractFactory("PeriodicRespect", implOwner);

  const implAddr = await upgrades.deployImplementation(
    factory, { kind: 'uups' }
  );

  const addr = implAddr.toString();
  // FIXME: why do I have to do a typecast here?
  const impl = factory.attach(addr) as PeriodicRespect;

  await expect(impl.initialize('ImplFractal', 'IF', implOwner.address)).to.not.be.reverted;

  expect(await impl.name()).to.equal('ImplFractal');

  await expect(impl.mint(signers[1]!, 5, 2, 0)).to.not.be.reverted;

  await checkConsistencyOfSupply(impl, 1, 5);
  await checkConsistencyOfBalance(impl, signers[1]!.address!, 1, 5);
  await checkConsistencyOfBalance(impl, signers[0]!.address!, 0, 0);

  return { implOwner, impl, factory, signers };
}

export async function deploy() {
  const { signers } = await deployImpl();

  const proxyOwner = signers[1]!;

  const factory = await ethers.getContractFactory("PeriodicRespect", proxyOwner);

  // FIXME: why do I have to do a typecast here?
  const proxy = (await upgrades.deployProxy(
    factory, ["TestFractal", "TF", proxyOwner.address], { kind: 'uups' }
  ) as unknown) as PeriodicRespect;

  return { proxy, proxyOwner, factory, signers };
}

describe("PeriodicRespect", function () {
  describe("Deployment", function () {
    it("Should not fail", async function () {
      await loadFixture(deploy);
    });
  });

  describe("packTokenId", function() {
    it("Should return TokenIdDataStruct packed to uint256", async function() {
      const { proxy, signers } = await loadFixture(deploy);

      const tokenData: TokenIdDataStruct = {
        owner: signers[0]!.address,
        periodNumber: 1,
        mintType: 2
      };
      const expPacked = packTokenId(tokenData);

      expect(ethers.toBeHex(await proxy.packTokenId(tokenData), 32)).to.be.equal(expPacked);
    });

    it("Should return TokenIdDataStruct unpacked from uint256", async function() {
      const { proxy, signers } = await loadFixture(deploy);

      const tokenData: TokenIdDataStruct = {
        owner: signers[1]!.address,
        periodNumber: 2,
        mintType: 1
      };
      const expPacked = packTokenId(tokenData);

      expect(ethers.toBeHex(await proxy.packTokenId(tokenData), 32)).to.be.equal(expPacked);

      const expUnpacked = normTokenIdData(unpackTokenId(expPacked));
      
      const unpacked = normTokenIdData(await proxy.unpackTokenId(expPacked));

      expect(unpacked).to.containSubset(normTokenIdData(tokenData));
      expect(unpacked).to.containSubset(expUnpacked);
    });
  });

  describe("mint", function () {
    it("Should mint with expected token id and value", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;
      const tokenId = packTokenId({
        owner: signers[1]!.address,
        mintType: 0, periodNumber: 0
      });
      expect(await proxy.valueOfToken(tokenId)).to.be.equal(2);

      await expect(proxy.mint(signers[2]!, 5, 1, 5)).to.not.be.reverted;
      const tokenId2 = packTokenId({
        owner: signers[2]!.address,
        mintType: 1, periodNumber: 5
      });
      expect(await proxy.valueOfToken(tokenId2)).to.be.equal(5);

      checkConsistencyOfSupply(proxy, 2, 7);
      checkConsistencyOfBalance(proxy, signers[1]!.address, 1, 2)
      checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 5)
    });

    it("Should mint to specified owner", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;
      const tokenId = packTokenId({
        owner: signers[1]!.address,
        mintType: 0, periodNumber: 0
      });
      expect(await proxy.ownerOf(tokenId)).to.be.equal(signers[1]!.address);

      await expect(proxy.mint(signers[2]!, 5, 1, 4)).to.not.be.reverted;
      const tokenId2 = packTokenId({
        owner: signers[2]!.address,
        mintType: 1, periodNumber: 4
      });
      expect(await proxy.ownerOf(tokenId2)).to.be.equal(signers[2]!.address);

      checkConsistencyOfSupply(proxy, 2, 7);
      checkConsistencyOfBalance(proxy, signers[1]!.address, 1, 2)
      checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 5)
    });

    it("Should now allow minting two tokens with the same owner, periodNumber, and mintType", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.be.reverted;
    });

    it("Should produce consistent supplies and balances", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[1]!, 2, 1, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[1]!, 2, 2, 0)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 3, 6);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 3, 6);

      await expect(proxy.mint(signers[2]!, 4, 0, 0)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 4, 10);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 3, 6);
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 4);

      await expect(proxy.mint(signers[3]!, 4, 0, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[3]!, 6, 1, 0)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 6, 20);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 3, 6);
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 4);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 10);

      await expect(proxy.mint(signers[4]!, 5, 0, 1)).to.not.be.reverted;
      await expect(proxy.mint(signers[5]!, 6, 0, 1)).to.not.be.reverted;
      await expect(proxy.mint(signers[6]!, 6, 0, 1)).to.not.be.reverted;
      await expect(proxy.mint(signers[7]!, 10, 0, 1)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 10, 47);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 3, 6);
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 4);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 10);
      await checkConsistencyOfBalance(proxy, signers[4]!.address, 1, 5);
      await checkConsistencyOfBalance(proxy, signers[5]!.address, 1, 6);
      await checkConsistencyOfBalance(proxy, signers[6]!.address, 1, 6);
      await checkConsistencyOfBalance(proxy, signers[7]!.address, 1, 10);
    });
  });

  describe("burn", function () {
    it("should not allow burning same token twice", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;
      const tokenId = packTokenId({
        owner: signers[1]!.address,
        mintType: 0, periodNumber: 0
      });

      await expect(proxy.burn(tokenId)).to.not.be.reverted;
      await expect(proxy.burn(tokenId)).to.be.reverted;

      checkConsistencyOfSupply(proxy, 1, 0);
      checkConsistencyOfBalance(proxy, signers[1]!.address, 1, 0);
    });

    it("should not allow burning a token that was not minted", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;

      // Note different owner
      const tokenId = packTokenId({
        owner: signers[2]!.address,
        mintType: 0, periodNumber: 0
      });
      await expect(proxy.burn(tokenId)).to.be.revertedWith('Token does not exist');

      // Different mintType
      const tokenId2 = packTokenId({
        owner: signers[1]!.address,
        mintType: 1, periodNumber: 0
      });
      await expect(proxy.burn(tokenId2)).to.be.revertedWith('Token does not exist');

      // Different periodNumber
      const tokenId3 = packTokenId({
        owner: signers[1]!.address,
        mintType: 0, periodNumber: 1
      });
      await expect(proxy.burn(tokenId3)).to.be.revertedWith('Token does not exist');

      const tokenId4 = packTokenId({
        owner: signers[1]!.address,
        mintType: 0, periodNumber: 0
      });
      await expect(proxy.burn(tokenId4)).to.not.be.reverted;

      checkConsistencyOfSupply(proxy, 1, 0);
      checkConsistencyOfBalance(proxy, signers[1]!.address, 1, 0);
    });

    it("Should preserve consistent supplies and balances", async function() {
      const { proxy, signers } = await loadFixture(deploy);            

      await expect(proxy.mint(signers[1]!, 2, 0, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[1]!, 3, 1, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[1]!, 10, 2, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[2]!, 10, 2, 0)).to.not.be.reverted;
      await expect(proxy.mint(signers[3]!, 21, 2, 1)).to.not.be.reverted;
      await expect(proxy.mint(signers[4]!, 55, 2, 1)).to.not.be.reverted;
      await expect(proxy.mint(signers[1]!, 55, 2, 2)).to.not.be.reverted;
      await expect(proxy.mint(signers[3]!, 21, 2, 2)).to.not.be.reverted;
      await expect(proxy.mint(signers[4]!, 10, 2, 2)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 9, 187);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 4, 70);
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 10);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 42);
      await checkConsistencyOfBalance(proxy, signers[4]!.address, 2, 65);

      let tokenId = await proxy.tokenOfOwnerByIndex(signers[1]!.address, 0);
      await expect(proxy.burn(tokenId)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 9, 185);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 4, 68)
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 10);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 42);
      await checkConsistencyOfBalance(proxy, signers[4]!.address, 2, 65);

      tokenId = await proxy.tokenOfOwnerByIndex(signers[1]!.address, 3);
      await expect(proxy.burn(tokenId)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 9, 130);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 4, 13)
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 10);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 42);
      await checkConsistencyOfBalance(proxy, signers[4]!.address, 2, 65);

      tokenId = await proxy.tokenByIndex(8);
      await expect(proxy.burn(tokenId)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 9, 120);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 4, 13)
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 10);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 42);
      await checkConsistencyOfBalance(proxy, signers[4]!.address, 2, 55);

      tokenId = await proxy.tokenByIndex(4);
      await expect(proxy.burn(tokenId)).to.not.be.reverted;

      await checkConsistencyOfSupply(proxy, 9, 99);
      await checkConsistencyOfBalance(proxy, signers[1]!.address, 4, 13)
      await checkConsistencyOfBalance(proxy, signers[2]!.address, 1, 10);
      await checkConsistencyOfBalance(proxy, signers[3]!.address, 2, 21);
      await checkConsistencyOfBalance(proxy, signers[4]!.address, 2, 55);
    });
  });

  describe("earningsPerLastPeriods", function() {
    it("should return respect earned per specified number of periods", async function() {
      const { proxy, signers } = await loadFixture(deploy);

      const acc1 = signers[4]!.address;

      await expect(proxy.mint(acc1, 10, 0, 0)).to.not.be.reverted;
      await expect(proxy.mint(acc1, 10, 0, 1)).to.not.be.reverted;
      await expect(proxy.mint(acc1, 10, 0, 2)).to.not.be.reverted;
      await expect(proxy.mint(acc1, 20, 1, 2)).to.not.be.reverted;

      expect(await proxy.earningsPerLastPeriods(acc1, 3)).to.be.equal(50);
      expect(await proxy.earningsPerLastPeriods(acc1, 2)).to.be.equal(40);
      expect(await proxy.earningsPerLastPeriods(acc1, 1)).to.be.equal(30);
    });
  });

  describe("setBaseURI", function() {
    it("should set base URI for token URIs", async function() {
      const { proxy, signers } = await loadFixture(deploy);

      const baseURI = "https://someWeb.io/";
      await expect(proxy.setBaseURI(baseURI)).to.not.be.reverted;

      const acc1 = signers[4]!.address;
      const acc2 = signers[5]!.address;

      await expect(proxy.mint(acc1, 10, 0, 0)).to.not.be.reverted;
      const tokenId1 = packTokenId({
        owner: acc1, mintType: 0, periodNumber: 0
      });
      await expect(proxy.mint(acc2, 20, 1, 2)).to.not.be.reverted;
      const tokenId2 = packTokenId({
        owner: acc2, mintType: 1, periodNumber: 2
      });

      expect(await proxy.tokenURI(tokenId1)).to.be.equal(`${baseURI}${ethers.toBigInt(tokenId1).toString()}`);
      expect(await proxy.tokenURI(tokenId2)).to.be.equal(`${baseURI}${ethers.toBigInt(tokenId2).toString()}`);
    });
  });

  describe("tokenURI", function() {
    it("should not return URI for un-minted token", async function() {
      const { proxy, signers } = await loadFixture(deploy);
      
      const baseURI = "https://someWeb.io/";
      await expect(proxy.setBaseURI(baseURI)).to.not.be.reverted;

      const acc1 = signers[4]!.address;

      await expect(proxy.mint(acc1, 10, 0, 0)).to.not.be.reverted;

      // Different period number
      const tokenId1 = packTokenId({
        owner: acc1, mintType: 0, periodNumber: 1
      });

      await expect(proxy.tokenURI(tokenId1)).to.be.rejected;
      
    });
  });

  describe("disabled transfers", function() {
    it("should revert", async function() {
      const { proxy, signers } = await loadFixture(deploy);

      const acc1 = signers[4]!.address;
      await expect(proxy.mint(acc1, 10, 0, 0)).to.not.be.reverted;

      const tokenId = await proxy.tokenByIndex(0);

      await expect(proxy.transferFrom(acc1, signers[0]!.address, tokenId)).to.be.revertedWithCustomError(proxy, 'OpNotSupported');
      await expect(proxy["safeTransferFrom(address,address,uint256)"](acc1, signers[0]!.address, tokenId)).to.be.revertedWithCustomError(proxy, 'OpNotSupported');
      await expect(proxy["safeTransferFrom(address,address,uint256,bytes)"](acc1, signers[0]!.address, tokenId, "0x00")).to.be.revertedWithCustomError(proxy, 'OpNotSupported');
    });
  })
});