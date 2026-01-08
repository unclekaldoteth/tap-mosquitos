// scripts/deploy-mainnet-all.cjs
// Deploy all contracts to Base Mainnet

const hre = require("hardhat");

async function main() {
    console.log("=".repeat(60));
    console.log("DEPLOYING ALL CONTRACTS TO BASE MAINNET");
    console.log("=".repeat(60));
    console.log("");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
        console.log("\n❌ No ETH! Cannot deploy. Please fund wallet first.");
        process.exit(1);
    }
    console.log("");

    // USDC CA on Base mainnet
    const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

    // Trusted signer (env override or deployer)
    const TRUSTED_SIGNER = process.env.SIGNER_ADDRESS || deployer.address;

    const deployedContracts = {};

    // ========================================
    // 1. Deploy MosquitoSlayerNFT
    // ========================================
    console.log("-".repeat(40));
    console.log("1. Deploying MosquitoSlayerNFT...");
    console.log("-".repeat(40));

    const MosquitoSlayerNFT = await hre.ethers.getContractFactory("MosquitoSlayerNFT");
    const mosquitoNFT = await MosquitoSlayerNFT.deploy(TRUSTED_SIGNER);
    await mosquitoNFT.waitForDeployment();
    deployedContracts.MosquitoSlayerNFT = await mosquitoNFT.getAddress();
    console.log("✅ MosquitoSlayerNFT:", deployedContracts.MosquitoSlayerNFT);
    console.log("");

    // ========================================
    // 2. Deploy PrizePool
    // ========================================
    console.log("-".repeat(40));
    console.log("2. Deploying PrizePool...");
    console.log("-".repeat(40));

    const PrizePool = await hre.ethers.getContractFactory("PrizePool");
    const prizePool = await PrizePool.deploy(USDC_ADDRESS, TRUSTED_SIGNER);
    await prizePool.waitForDeployment();
    deployedContracts.PrizePool = await prizePool.getAddress();
    console.log("✅ PrizePool:", deployedContracts.PrizePool);
    console.log("");

    // ========================================
    // 3. Deploy VersusNFT
    // ========================================
    console.log("-".repeat(40));
    console.log("3. Deploying VersusNFT...");
    console.log("-".repeat(40));

    const VersusNFT = await hre.ethers.getContractFactory("VersusNFT");
    const versusNFT = await VersusNFT.deploy(TRUSTED_SIGNER);
    await versusNFT.waitForDeployment();
    deployedContracts.VersusNFT = await versusNFT.getAddress();
    console.log("✅ VersusNFT:", deployedContracts.VersusNFT);
    console.log("");

    // ========================================
    // Summary
    // ========================================
    console.log("=".repeat(60));
    console.log("ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("");
    console.log("Contract Addresses:");
    console.log("  MosquitoSlayerNFT:", deployedContracts.MosquitoSlayerNFT);
    console.log("  PrizePool:", deployedContracts.PrizePool);
    console.log("  VersusNFT:", deployedContracts.VersusNFT);
    console.log("");
    console.log("Trusted Signer:", TRUSTED_SIGNER);
    console.log("USDC Address:", USDC_ADDRESS);
    console.log("");
    console.log("Add to .env:");
    console.log(`VITE_NFT_CONTRACT_ADDRESS=${deployedContracts.MosquitoSlayerNFT}`);
    console.log(`VITE_PRIZE_POOL_ADDRESS=${deployedContracts.PrizePool}`);
    console.log(`VITE_VERSUS_CONTRACT_ADDRESS=${deployedContracts.VersusNFT}`);
    console.log("");
    console.log("Verify commands:");
    console.log(`npx hardhat verify --network baseMainnet ${deployedContracts.MosquitoSlayerNFT} "${TRUSTED_SIGNER}"`);
    console.log(`npx hardhat verify --network baseMainnet ${deployedContracts.PrizePool} "${USDC_ADDRESS}" "${TRUSTED_SIGNER}"`);
    console.log(`npx hardhat verify --network baseMainnet ${deployedContracts.VersusNFT} "${TRUSTED_SIGNER}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
