import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { ethers, upgrades } from "hardhat";
import { FractalRespectUpgraded, PeriodicRespect, PeriodicRespect__factory } from "../typechain-types";
import { BigNumberish } from "ethers";
import { type TokenIdDataStruct, packTokenId, unpackTokenId, tokenIdDataEq, normTokenIdData } from "../utils/tokenId";
import { checkConsistencyOfBalance, checkConsistencyOfSupply } from "./consistencyChecks";
import { deploy as deployPeriodicRespect } from "./PeriodicRespectTests";
import { GroupRanksStruct } from "./FractalRespectTests";

export async function deployFractalRespectImpl() {
  // Contracts are deployed using the first signer/account by default
  const signers = await ethers.getSigners();

  const implOwner = signers[0]!;
  const implExecutor = signers[1]!;

  const factory = await ethers.getContractFactory("FractalRespectUpgraded", implOwner);
  const factoryOfExec = await ethers.getContractFactory("FractalRespectUpgraded", implExecutor);

  const implAddr = await upgrades.deployImplementation(
    factory, { kind: 'uups' }
  );

  const addr = implAddr.toString();
  // FIXME: why do I have to do a typecast here?
  const impl = factory.attach(addr) as FractalRespectUpgraded;

  await expect(impl["initialize(string,string,address,address,uint64)"](
    'ImplFractal', 'IF', implOwner.address, implExecutor.address, 518400 // 6 days 
  )).to.not.be.reverted;

  expect(await impl.name()).to.equal('ImplFractal');

  await expect(impl.mint(signers[1]!, 5, 2, 0)).to.not.be.reverted;

  await checkConsistencyOfSupply(impl, 1, 5);
  await checkConsistencyOfBalance(impl, signers[1]!.address!, 1, 5);
  await checkConsistencyOfBalance(impl, signers[0]!.address!, 0, 0);

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

  return { implOwner, impl, factory, signers, submitRanksEx2, factoryOfExec };
}

// TODO: check if the implementation used the same deployed by me

describe("Upgrades", function() {
  it("should allow deploying PeriodicRespect contract and then upgrade it to FractalRespect", async function() {
    const { proxy, signers } = await loadFixture(deployPeriodicRespect);

    const { factory, impl, submitRanksEx2, factoryOfExec } = await deployFractalRespectImpl();

    // await expect(((proxy as unknown) as FractalRespectUpgraded).submitRanks(submitRanksEx2)).to.throw;

    const contract = (await upgrades.upgradeProxy(proxy, factory, {
      kind: "uups",
      call: { fn: 'initializeV2(address,uint64)', args: [signers[6]!.address, 518400] }
    }) as unknown) as FractalRespectUpgraded;

    expect(await contract.executor()).to.equal(signers[6]!.address);

    await expect(contract.submitRanks(submitRanksEx2)).to.not.be.reverted;
  });

  it("should not allow non-owner to trigger an update", async function() {

  });
});