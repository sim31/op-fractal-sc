import { ethers, upgrades } from "hardhat";
import { FractalRespect } from "../typechain-types/contracts";
import "dotenv/config"

const proxyAddr = process.env.OPGOERLI_PROXY_ADDR!; 
console.log('proxy: ', proxyAddr);

export async function upgradeFractalRespectProxy() {
  const signers = await ethers.getSigners();

  const factory = await ethers.getContractFactory("FractalRespect", signers[0]!);

  const contract = (await upgrades.upgradeProxy(proxyAddr, factory, {
    kind: "uups",
    constructorArgs: [
      'ImplFractal2-1', 'IF2', signers[0]!.address, signers[0]!.address, 518400
    ],
  }) as unknown) as FractalRespect;

  return contract;
}

async function main() {
  const vars = await upgradeFractalRespectProxy();

  console.log('Deployed: ', vars);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});