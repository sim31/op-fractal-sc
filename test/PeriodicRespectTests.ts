import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PeriodicRespect, PeriodicRespect__factory } from "../typechain-types";

describe("PeriodicRespect", function () {
  async function deployImpl() {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();

    const implOwner = signers[0]!;

    const factory = new PeriodicRespect__factory(implOwner);

    const implAddr = await upgrades.deployImplementation(
      factory, { kind: 'uups' }
    );

    const addr = implAddr.toString();
    const impl = factory.attach(addr) as PeriodicRespect;

    await expect(impl.initialize('ImplFractal', 'IF', implOwner.address)).to.not.be.reverted;

    expect(await impl.name()).to.equal('ImplFractal');

    await expect(impl.mint(signers[1]!.address, 5, 2, 0)).to.not.be.reverted;

    expect(await impl.balanceOf(signers[1]!.address)).to.be.equal(5);

    return { implOwner, impl, factory, signers };
  }

  async function deploy() {
    const { factory, signers } = await deployImpl();

    const proxyOwner = signers[1]!;

    const proxy = await upgrades.deployProxy(
      factory, ["TestFractal", "TF", proxyOwner.address]
    );

    return { proxy, proxyOwner, factory, signers };
  }

  describe("Deployment", function () {
    it("Should not fail", async function () {
      console.log('test');
      await loadFixture(deploy);
    });
  });

  describe("submitCons", function () {
  })
});