import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("FractalInputsLogger", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deploy() {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();

    const factory = await ethers.getContractFactory("FractalInputsLogger");
    const contract = await factory.deploy();

    return { contract, signers };
  }

  describe("Deployment", function () {
    it("Should not fail", async function () {
      await loadFixture(deploy);
    });
  });

  describe("submitConsEF", function () {
    it("should emit event with a hash of submitted arguments and submitter", async function() {
      const { contract, signers } = await loadFixture(deploy);

      const delegate = signers[0]!.address;
      const ranks = signers.slice(0, 6).map(s => s.address);
      const submitter = ranks[0]!;

      const results = {
        groupNum: 1,
        ranks,
        delegate,
      };

      const response = contract.submitConsEF(results, { from: submitter });

      const resultHash = ethers.solidityPackedKeccak256(
        [ "uint8", "address[6]", "address" ],
        [ 1, ranks, delegate ]
      );

      await expect(response)
        .to.emit(contract, "ConsensusSubmissionEF")
        .withArgs(submitter, resultHash);
    });

    it("should emit event with a hash of submitted args and submitter, even if delegate is 0", async function() {
      const { contract, signers } = await loadFixture(deploy);

      const delegate = ethers.ZeroAddress;
      const ranks = signers.slice(0, 6).map(s => s.address);
      const submitter = signers[0]!;

      const results = {
        groupNum: 5,
        ranks,
        delegate,
      };

      const resultHash = ethers.solidityPackedKeccak256(
        [ "uint8", "address[6]", "address" ],
        [ 5, ranks, delegate ]
      );

      const response = contract.submitConsEF(results, { from: submitter });
      await expect(response)
        .to.emit(contract, "ConsensusSubmissionEF")
        .withArgs(submitter.address, resultHash)
    });
  });

  describe("submitCons", function () {
    it("should emit event with submitted args and submitter", async function() {
      const { contract, signers } = await loadFixture(deploy);

      const ranks = signers.slice(0, 6).map(s => s.address);
      const submitter = ranks[0];

      const results = {
        groupNum: 1,
        ranks,
      };

      const resultHash = ethers.solidityPackedKeccak256(
        [ "uint8", "address[6]" ],
        [ 1, ranks ]
      );

      const response = contract.submitCons(results, { from: submitter });

      await expect(response)
        .to.emit(contract, "ConsensusSubmission")
        .withArgs(submitter, resultHash);
    });
  });
});
