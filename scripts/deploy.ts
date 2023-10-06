import { ethers, upgrades } from "hardhat";
import { FractalRespect } from "../typechain-types/contracts";

export async function deployFractalRespect() {
  const signers = await ethers.getSigners();

  const proxyOwner = signers[1]!;
  const proxyExecutor = signers[2]!;
  const proxyOther = signers[5]!;
  
  const implOwner = signers[10]!;
  const implExecutor = signers[11]!;

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
      initializer: "initializeV2Whole(string,string,address,address,uint64)",
      constructorArgs: ['ImplFractal', 'IF', implOwner.address, implExecutor.address, 518400]
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
    proxyOther,
    factory,
    execFactory,
    otherFactory,
    signers,
    ranksDelay,
  };
}

async function main() {
  const vars = await deployFractalRespect();

  console.log('Deployed: ', vars);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
