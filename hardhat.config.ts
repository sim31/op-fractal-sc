import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config"

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    opGoerli: {
      url: `https://optimism-goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [
        process.env.OPGOERLI_PRIV_KEY!,
      ]
    }
  },
  etherscan: {
    apiKey: process.env.OPGOERLI_ETHERSCAN_KEY
  }
};

export default config;
