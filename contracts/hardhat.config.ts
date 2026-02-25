import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

import path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.22",
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
        },
        bscTestnet: {
            url: "https://bsc-testnet.bnbchain.org",
            chainId: 97,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            timeout: 120000,
        },
        bsc: {
            url: "https://bsc-rpc.publicnode.com",
            chainId: 56,
            accounts: (() => {
                const dk = process.env.DEPLOY_PRIVATE_KEY;
                const pk = process.env.PRIVATE_KEY;
                const key = dk || pk;
                if (!key) return [];
                const normalized = key.startsWith('0x') ? key : `0x${key}`;
                if (dk) console.log("[hardhat] Using DEPLOY_PRIVATE_KEY");
                return [normalized];
            })(),
            timeout: 600000,
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

export default config;
