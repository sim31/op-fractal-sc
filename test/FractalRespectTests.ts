import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { FractalRespect } from "../typechain-types/contracts/FractalRespect";
import { BigNumberish } from "ethers";
import { type TokenIdDataStruct, packTokenId, unpackTokenId, tokenIdDataEq, normTokenIdData } from "../utils/tokenId";
import { checkConsistencyOfBalance, checkConsistencyOfSupply } from "./consistencyChecks"

async function deployImpl() {
  // Contracts are deployed using the first signer/account by default
  const signers = await ethers.getSigners();

  const implOwner = signers[0]!;
  const implExecutor = signers[1]!;

  const factory = await ethers.getContractFactory("FractalRespect", implOwner);

  const implAddr = await upgrades.deployImplementation(
    factory, { kind: 'uups' }
  );

  const addr = implAddr.toString();
  // FIXME: why do I have to do a typecast here?
  const impl = factory.attach(addr) as FractalRespect;

  await expect(impl["initialize(string,string,address,address,uint64)"](
    'ImplFractal', 'IF', implOwner.address, implExecutor.address, 518400 // 6 days 
  )).to.not.be.reverted;

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
  const proxyExecutor = signers[2]!;

  const factory = await ethers.getContractFactory("FractalRespect", proxyOwner);
  const execFactory = await ethers.getContractFactory("FractalRespect", proxyExecutor);
  const otherFactory = await ethers.getContractFactory("FractalRespect", signers[2]);

  const ranksDelay = 518400; // 6 days

  // FIXME: why do I have to do a typecast here?
  const proxyFromOwner = (await upgrades.deployProxy(
    factory,
    ["TestFractal", "TF", proxyOwner.address, proxyExecutor.address, ranksDelay],
    {
      kind: 'uups',
      initializer: "initialize(string,string,address,address,uint64)"
    }
  ) as unknown) as FractalRespect;

  const proxyFromExec = execFactory.attach(await proxyFromOwner.getAddress()) as FractalRespect;
  const proxyFromOther = otherFactory.attach(await proxyFromOwner.getAddress()) as FractalRespect;

  return {
    proxyFromOwner,
    proxyFromExec,
    proxyFromOther,
    proxyOwner,
    proxyExecutor,
    factory,
    signers,
    ranksDelay,
  };
}


describe("FractalRespect", function () {
  describe("Deployment", function () {
    it("Should not fail and set specified parameters", async function () {
      const { proxyOwner, proxyExecutor, ranksDelay, proxyFromExec} = await loadFixture(deploy);

      expect(await proxyFromExec.ranksDelay()).to.equal(ranksDelay);
      expect(await proxyFromExec.executor()).to.equal(proxyExecutor.address);
      expect(await proxyFromExec.owner()).to.equal(proxyOwner.address);
      expect(await proxyFromExec.name()).to.equal("TestFractal");
      expect(await proxyFromExec.symbol()).to.equal("TF");
      expect(await proxyFromExec.lastRanksTime()).to.equal(0);
      expect(await proxyFromExec.totalSupply()).to.equal(0);
      expect(await proxyFromExec.tokenSupply()).to.equal(0);
    });
  });
});