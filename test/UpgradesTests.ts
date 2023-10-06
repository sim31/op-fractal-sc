import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { ethers, upgrades } from "hardhat";
import { FractalRespect } from "../typechain-types";
import { BigNumberish } from "ethers";
import { type TokenIdDataStruct, packTokenId, unpackTokenId, tokenIdDataEq, normTokenIdData } from "../utils/tokenId";
import { checkConsistencyOfBalance, checkConsistencyOfSupply } from "./consistencyChecks";
import { deploy as deployPeriodicRespect } from "./PeriodicRespectTests";
import { GroupRanksStruct, deploy as deployFractalRespect } from './FractalRespectTests';

export async function deploy() {
  return await loadFixture(deployPeriodicRespect);
}

describe("Upgrades", function() {
  it("should allow deploying PeriodicRespect contract and then upgrade it to FractalRespect", async function() {
    const { proxy, signers, proxyOwner } = await loadFixture(deploy);

    // TODO: Check that this is the old version somehow
    const proxyExecutor = signers[6]!.address;

    const factory = await ethers.getContractFactory("FractalRespect", proxyOwner);

    const contract = (await upgrades.upgradeProxy(proxy, factory, {
      kind: "uups",
      constructorArgs: [
        'ImplFractal', 'IF', signers[10]!.address, signers[11]!.address, 518400
      ],
      call: { fn: 'initializeV2(address,uint64)', args: [proxyExecutor, 518400] }
    }) as unknown) as FractalRespect;

    expect(await contract.executor()).to.equal(proxyExecutor);

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

    await expect(contract.submitRanks(submitRanksEx2)).to.not.be.reverted;
  });

  it("should not allow non-owner to trigger an update", async function() {
    const { proxy, signers } = await loadFixture(deploy);

    // TODO: Check that this is the old version somehow
    const proxyExecutor = signers[6]!.address;

    const factory = await ethers.getContractFactory("FractalRespect", signers[5]);

    await expect(upgrades.upgradeProxy(proxy, factory, {
      kind: "uups",
      constructorArgs: [
        'ImplFractal', 'IF', signers[10]!.address, signers[11]!.address, 518400
      ],
      call: { fn: 'initializeV2(address,uint64)', args: [proxyExecutor, 518400] }
    })).to.be.rejected;

  });
});