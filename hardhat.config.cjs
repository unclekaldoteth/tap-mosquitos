require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        baseSepolia: {
            url: "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 84532
        },
        baseMainnet: {
            url: "https://mainnet.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 8453
        }
    },
    etherscan: {
        apiKey: process.env.BASESCAN_API_KEY || "",
        customChains: [
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api?chainid=84532",
                    browserURL: "https://sepolia.basescan.org"
                }
            },
            {
                network: "baseMainnet",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.etherscan.io/v2/api?chainid=8453",
                    browserURL: "https://basescan.org"
                }
            }
        ]
    },
    paths: {
        sources: "./contracts",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
