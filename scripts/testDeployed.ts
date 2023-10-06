import { ethers } from "hardhat";
import { FractalRespect } from "../typechain-types/contracts";

const address = '0x71c95911e9a5d330f4d621842ec243ee1343292e'

type GroupRanksStruct = FractalRespect.GroupRanksStruct;

async function testSubmitRanks() {
  const signers = await ethers.getSigners();

  const proxyExecutor = signers[2]!;

  const factoryExec = await ethers.getContractFactory("FractalRespect", proxyExecutor);

  const proxyFromExec = await factoryExec.attach(address) as FractalRespect;

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
  const resp = await proxyFromExec.submitRanks(submitRanksEx2);
  const receipt = await resp.wait();
  if (receipt?.status !== 1) {
    console.error("transaction failed: ", receipt);
  } else {
    console.log("submitRanks: ", receipt);
  }
}

async function testSubmitCons() {
  const signers = await ethers.getSigners();

  const factory = await ethers.getContractFactory("FractalRespect", signers[10]);

  const proxy = await factory.attach(address) as FractalRespect;

  const delegate = signers[0]!.address;
  const ranks = signers.slice(0, 6).map(s => s.address);

  const results = {
    groupNum: 1,
    ranks,
    delegate,
  };

  const resp = await proxy.submitCons(results);
  const receipt = await resp.wait();
  if (receipt?.status !== 1) {
    console.error("transaction failed: ", receipt);
  } else {
    console.log("submitCons: ", receipt);
  }
}

async function main() {
  await testSubmitCons();
  await testSubmitRanks();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});