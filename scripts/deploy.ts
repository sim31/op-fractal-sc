import { ethers, upgrades } from "hardhat";
import { FractalRespect } from "../typechain-types/contracts";
import "dotenv/config"

const implOwner = process.env.IMPL_OWNER_ADDR;
const implExec = process.env.IMPL_EXEC_ADDR;
const proxyOwner = process.env.PROXY_OWNER_ADDR;
const proxyExec = process.env.PROXY_EXEC_ADDR;

export async function deployFractalRespect() {
  const signers = await ethers.getSigners();

  const factory = await ethers.getContractFactory("FractalRespect", signers[0]!);
  const ranksDelay = 518400; // 6 days

  // FIXME: why do I have to do a typecast here?
  const proxyFromOwner = (await upgrades.deployProxy(
    factory,
    ["TestFractal", "TF", proxyOwner, proxyExec, ranksDelay],
    {
      kind: 'uups',
      initializer: "initializeV2Whole(string,string,address,address,uint64)",
      constructorArgs: ['ImplFractal', 'IF', implOwner, implExec, 518400]
    }
  ) as unknown) as FractalRespect;

  return {
    proxyFromOwner,
    proxyOwner,
    factory,
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
