import { BigNumberish } from 'ethers';
import { PeriodicRespect } from '../typechain-types/contracts/PeriodicRespect';
import { ethers } from 'hardhat';

export type TokenIdDataStruct = PeriodicRespect.TokenIdDataStruct;
export type TokenIdDataStructOutput = PeriodicRespect.TokenIdDataStructOutput;
export type TokenId = BigNumberish;

export function normTokenIdData(
  data: TokenIdDataStructOutput | TokenIdDataStruct): TokenIdDataStruct {
  return {
    mintType: ethers.toBeHex(data.mintType),
    periodNumber: ethers.toBeHex(data.periodNumber, 8),
    owner: ethers.hexlify(data.owner.toString())
  }
}

export function tokenIdDataEq(
  data1: TokenIdDataStruct | TokenIdDataStructOutput,
  data2: TokenIdDataStruct | TokenIdDataStructOutput
): boolean {
  return (
    ethers.toNumber(data1.mintType) === ethers.toNumber(data2.mintType) &&
    ethers.toNumber(data1.periodNumber) === ethers.toNumber(data2.periodNumber) &&
    data1.owner.toString() === data2.owner.toString()
  );
}


export function packTokenId(data: TokenIdDataStruct): TokenId {
  const mintTypeHex = ethers.toBeHex(data.mintType);
  const periodNumberHex = ethers.toBeHex(data.periodNumber, 8);
  const r = ethers.concat([
    "0x000000",
    mintTypeHex,
    periodNumberHex,
    data.owner.toString(),
  ]);
  return r;
}

export function unpackTokenId(tokenId: TokenId): TokenIdDataStruct {
  const bytes = ethers.zeroPadValue(ethers.toBeArray(tokenId), 32);
  const mintType = ethers.dataSlice(bytes, 3, 4);
  const periodNumber = ethers.dataSlice(bytes, 4, 12);
  const owner = ethers.dataSlice(bytes, 12, 32);
  return {
    mintType, periodNumber, owner
  };
}