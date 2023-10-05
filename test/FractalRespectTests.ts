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

export type GroupRanksStruct = FractalRespect.GroupRanksStruct;

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
  const proxyOther = signers[5]!;

  const factory = await ethers.getContractFactory("FractalRespect", proxyOwner);
  const execFactory = await ethers.getContractFactory("FractalRespect", proxyExecutor);
  const otherFactory = await ethers.getContractFactory("FractalRespect", proxyOther);

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

  const submitRanksEx1: GroupRanksStruct[] = [
    {
      groupNum: 1,
      ranks: [
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        signers[0]!.address,
        signers[1]!.address,
        signers[2]!.address,
      ]
    },
    {
      groupNum: 2,
      ranks: [
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        signers[3]!.address,
        signers[4]!.address,
        signers[5]!.address,
        signers[6]!.address,
      ]
    },
    {
      groupNum: 3,
      ranks: [
        signers[7]!.address,
        signers[8]!.address,
        signers[9]!.address,
        signers[10]!.address,
        signers[11]!.address,
        signers[12]!.address,
      ]
    }
  ];

  const submitRanksEx2: GroupRanksStruct[] = [
    {
      groupNum: 1,
      ranks: [
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        signers[2]!.address,
        signers[1]!.address,
        signers[0]!.address,
      ]
    },
  ];

  return {
    proxyFromOwner,
    proxyFromExec,
    proxyFromOther,
    proxyOwner,
    proxyExecutor,
    proxyOther,
    factory,
    signers,
    ranksDelay,
    submitRanksEx1, submitRanksEx2
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
      expect(await proxyFromExec.periodNumber()).to.equal(0);
      expect(await proxyFromExec.totalSupply()).to.equal(0);
      expect(await proxyFromExec.tokenSupply()).to.equal(0);
    });
  });

  describe("submitRanks", function() {
    it('should revert if not called by issuer (owner) or executor', async function() {
      const { signers, proxyFromOther } = await loadFixture(deploy);

      const res: GroupRanksStruct[] = [
        {
          groupNum: 1,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[0]!.address,
            signers[1]!.address,
            signers[2]!.address,
            signers[3]!.address,
          ]
        }
      ];

      await expect(proxyFromOther.submitRanks(res)).to.be.revertedWith(
        "Only executor or issuer can do this"
      );
    });

    it('should revert if called with less than 3 addresses are ranked', async function() {
      const { signers, proxyFromExec } = await loadFixture(deploy);

      const res: GroupRanksStruct[] = [
        {
          groupNum: 1,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[2]!.address,
            signers[3]!.address,
          ]
        }
      ];

      await expect(proxyFromExec.submitRanks(res)).to.be.revertedWith(
        "At least 3 non-zero addresses have to be ranked"
      );
    });

    it('should revert if not enough time has passed since previous submitranks', async function() {
      const { signers, proxyFromExec } = await loadFixture(deploy);

      const res: GroupRanksStruct[] = [
        {
          groupNum: 1,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[4]!.address,
            signers[2]!.address,
            signers[3]!.address,
          ]
        },
        {
          groupNum: 2,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[5]!.address,
            signers[6]!.address,
            signers[1]!.address,
            signers[0]!.address,
          ]
        }
      ];

      await expect(proxyFromExec.submitRanks(res)).to.not.be.reverted;

      await expect(proxyFromExec.submitRanks(res)).to.be.revertedWith(
        "ranksDelay amount of time has to pass before next submitRanks"
      );
    });

    it('should allow a second submitranks after enough time have passed', async function() {
      const { submitRanksEx1, submitRanksEx2, proxyFromExec } = await loadFixture(deploy);

      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.not.be.reverted;

      time.increase(604800); // 7 days

      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.not.be.reverted;
    });

    it('should increment periodNumber after submission', async function() {
      const { submitRanksEx1, submitRanksEx2, proxyFromExec } = await loadFixture(deploy);

      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.not.be.reverted;

      expect(await proxyFromExec.periodNumber()).to.equal(1);

      time.increase(604800); // 7 days

      await expect(proxyFromExec.submitRanks(submitRanksEx2)).to.not.be.reverted;

      expect(await proxyFromExec.periodNumber()).to.equal(2);
    });

    it("should not allow the same account to be ranked twice in the same group", async function() {
      const { proxyFromExec, signers } = await loadFixture(deploy);

      const res: GroupRanksStruct[] = [
        {
          groupNum: 1,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[0]!.address,
            signers[2]!.address,
            signers[1]!.address,
            signers[0]!.address,
          ]
        },
      ];

      await expect(proxyFromExec.submitRanks(res)).to.be.revertedWith(
        "token id already minted"
      );
    });

    it("should not allow the same account to be ranked twice in different groups", async function() {
      const { proxyFromExec, signers } = await loadFixture(deploy);

      const res: GroupRanksStruct[] = [
        {
          groupNum: 0,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[3]!.address,
            signers[2]!.address,
            signers[1]!.address,
            signers[0]!.address,
          ]
        },
        {
          groupNum: 1,
          ranks: [
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            signers[6]!.address,
            signers[5]!.address,
            signers[4]!.address,
            signers[0]!.address,

          ]
        }
      ];

      await expect(proxyFromExec.submitRanks(res)).to.be.revertedWith(
        "token id already minted"
      );
    });
    
    it('should issue respect based on rankings', async function() {
      const { submitRanksEx1, submitRanksEx2, proxyFromExec } = await loadFixture(deploy);

      // First period
      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.not.be.reverted;
      expect(await proxyFromExec.periodNumber()).to.equal(1);

      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[0]!.ranks[5]!.toString(),
        1,
        55
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[0]!.ranks[4]!.toString(),
        1,
        34
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[0]!.ranks[3]!.toString(),
        1,
        21
      );

      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[1]!.ranks[5]!.toString(),
        1,
        55
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[1]!.ranks[4]!.toString(),
        1,
        34
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[1]!.ranks[3]!.toString(),
        1,
        21
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[1]!.ranks[2]!.toString(),
        1,
        13
      );

      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[2]!.ranks[5]!.toString(),
        1,
        55
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[2]!.ranks[4]!.toString(),
        1,
        34
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[2]!.ranks[3]!.toString(),
        1,
        21
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[2]!.ranks[2]!.toString(),
        1,
        13
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[2]!.ranks[1]!.toString(),
        1,
        8
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[2]!.ranks[0]!.toString(),
        1,
        5
      );
      await checkConsistencyOfSupply(proxyFromExec, 13, 369);

      time.increase(604800); // 7 days

      // Second period
      await expect(proxyFromExec.submitRanks(submitRanksEx2)).to.not.be.reverted;
      expect(await proxyFromExec.periodNumber()).to.equal(2);


      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx2[0]!.ranks[5]!.toString(),
        2,
        76
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[0]!.ranks[4]!.toString(),
        2,
        68
      );
      await checkConsistencyOfBalance(
        proxyFromExec,
        submitRanksEx1[0]!.ranks[3]!.toString(),
        2,
        76
      );
      await checkConsistencyOfSupply(proxyFromExec, 16, 479);
    });
  });

  describe("setRanksDelay", function() {
    it("should revert if not the owner is calling", async function() {
      const { proxyFromExec } = await loadFixture(deploy);

      await expect(proxyFromExec.setRanksDelay(86400)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("should change the amount of time required between submitranks", async function() {
      const { submitRanksEx1, submitRanksEx2, proxyFromExec, proxyFromOwner } = await loadFixture(deploy);

      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.not.be.reverted;

      time.increase(86400); // 1 day

      await expect(proxyFromExec.submitRanks(submitRanksEx2)).to.be.revertedWith(
        "ranksDelay amount of time has to pass before next submitRanks"
      );

      // Note that we are calling from owner
      await expect(proxyFromOwner.setRanksDelay(86400)).to.not.be.reverted;

      await expect(proxyFromExec.submitRanks(submitRanksEx2)).to.not.be.reverted;
    })
  });

  describe("setExecutor", function() {
    it("should revert if not issuer or executor is calling it", async function() {
      const { proxyOther, proxyFromExec, proxyFromOther, proxyFromOwner } = await loadFixture(deploy);

      await expect(proxyFromOther.setExecutor(proxyOther)).to.be.revertedWith(
        "Only executor or issuer can do this"
      );
    });

    it("should change who is allowed to call submitranks", async function() {
      const { submitRanksEx1, proxyOther, proxyExecutor, proxyFromExec, proxyFromOther, proxyFromOwner } = await loadFixture(deploy);

      await expect(proxyFromOwner.setExecutor(proxyOther)).to.not.be.reverted;

      // Submit from old exec does not work
      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.be.revertedWith(
        "Only executor or issuer can do this"
      );
      // Works from the new
      await expect(proxyFromOther.submitRanks(submitRanksEx1)).to.not.be.reverted;

      // Now calling to set new exec from the (current) executor
      await expect(proxyFromOther.setExecutor(proxyExecutor)).to.not.be.reverted;
      time.increase(604800); // 7 days
      await expect(proxyFromExec.submitRanks(submitRanksEx1)).to.not.be.reverted;
    });
  });
});