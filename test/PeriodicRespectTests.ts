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

chai.use(chaiSubset);

export async function checkConsistency(
  contract: PeriodicRespect,
  tokenSupplyFun: () => Promise<bigint>,
  totalSupplyFun: () => Promise<bigint>,
  byIndexFun: (index: BigNumberish) => Promise<bigint>,
  expTokenSupply?: number,
  expTotalSupply?: number,
) {
  const tokenCount = await tokenSupplyFun();
  if (expTokenSupply !== undefined) {
    expect(tokenCount).to.equal(expTokenSupply);
  }
  const totalSupply = await totalSupplyFun();
  if (expTotalSupply !== undefined) {
    expect(totalSupply).to.equal(expTotalSupply);
  }

  let valueSum: bigint = BigInt(0);
  let i;
  for (i = 0; i < tokenCount; i++) {
    const tokenId = await byIndexFun(i);
    const value = await contract.valueOfToken(tokenId);
    valueSum += value;
  }
  // Any indexes bigger than or equal to tokenSupply should fail
  await expect(byIndexFun(i)).to.be.rejected;

  expect(totalSupply).to.equal(valueSum);
}

export async function checkConsistencyOfSupply(
  contract: PeriodicRespect,
  expTokenSupply?: number,
  expTotalSupply?: number,
) {
  await checkConsistency(
    contract,
    contract.tokenSupply,
    contract.totalSupply,
    contract.tokenByIndex,
    expTokenSupply,
    expTotalSupply
  );
}

export async function checkConsistencyOfBalance(
  contract: PeriodicRespect,
  account: string,
  expTokenSupply?: number,
  expBalance?: number,
) {
  await checkConsistency(
    contract,
    async () => { return await contract.tokenSupplyOfOwner(account) },
    async () => { return await contract.balanceOf(account) },
    async (index: BigNumberish) => { return contract.tokenOfOwnerByIndex(account, index)},
    expTokenSupply,
    expBalance
  );
}

async function deployImpl() {
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

async function deploy() {
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

    // TODO: test for not allowing the same tokenId...
  });

  describe("burn", function () {
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
});