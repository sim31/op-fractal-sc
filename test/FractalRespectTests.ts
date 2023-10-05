import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import chai, { expect } from "chai";
import chaiSubset from "chai-subset";
import { ethers, upgrades } from "hardhat";
import { PeriodicRespect, PeriodicRespect__factory } from "../typechain-types";
import { BigNumberish } from "ethers";
import { type TokenIdDataStruct, packTokenId, unpackTokenId, tokenIdDataEq, normTokenIdData } from "../utils/tokenId";