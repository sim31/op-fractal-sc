import { BigNumberish } from "ethers";
import { PeriodicRespect, FractalRespect } from "../typechain-types";
import chai, { expect } from "chai";

type SupportedContracts = PeriodicRespect | FractalRespect;

export async function checkConsistency(
  contract: SupportedContracts, 
  tokenSupplyFun: () => Promise<bigint>,
  totalSupplyFun: () => Promise<bigint>,
  byIndexFun: (index: BigNumberish) => Promise<bigint>,
  expTokenSupply?: number,
  expTotalSupply?: number,
) {
  const tokenCount = await tokenSupplyFun();
  if (expTokenSupply !== undefined) {
    expect(tokenCount).to.equal(expTokenSupply);
  }
  const totalSupply = await totalSupplyFun();
  if (expTotalSupply !== undefined) {
    expect(totalSupply).to.equal(expTotalSupply);
  }

  let valueSum: bigint = BigInt(0);
  let i;
  for (i = 0; i < tokenCount; i++) {
    const tokenId = await byIndexFun(i);
    const value = await contract.valueOfToken(tokenId);
    valueSum += value;
  }
  // Any indexes bigger than or equal to tokenSupply should fail
  await expect(byIndexFun(i)).to.be.rejected;

  expect(totalSupply).to.equal(valueSum);
}

export async function checkConsistencyOfSupply(
  contract: SupportedContracts,
  expTokenSupply?: number,
  expTotalSupply?: number,
) {
  await checkConsistency(
    contract,
    contract.tokenSupply,
    contract.totalSupply,
    contract.tokenByIndex,
    expTokenSupply,
    expTotalSupply
  );
}

export async function checkConsistencyOfBalance(
  contract: SupportedContracts,
  account: string,
  expTokenSupply?: number,
  expBalance?: number,
) {
  await checkConsistency(
    contract,
    async () => { return await contract.tokenSupplyOfOwner(account) },
    async () => { return await contract.balanceOf(account) },
    async (index: BigNumberish) => { return contract.tokenOfOwnerByIndex(account, index)},
    expTokenSupply,
    expBalance
  );
}
