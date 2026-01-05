// scripts/deploy-prizepool.cjs
// Deploy PrizePool contract to Base mainnet

const hre = require("hardhat");

async function main() {
    console.log("Deploying PrizePool to Base...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // USDC on Base mainnet
    const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

    // Trusted signer (same as deployer for now)
    const TRUSTED_SIGNER = deployer.address;

    console.log("Constructor parameters:");
    console.log("  USDC:", USDC_ADDRESS);
    console.log("  Trusted Signer:", TRUSTED_SIGNER);
    console.log("");

    // Deploy
    const PrizePool = await hre.ethers.getContractFactory("PrizePool");
    const prizePool = await PrizePool.deploy(USDC_ADDRESS, TRUSTED_SIGNER);

    await prizePool.waitForDeployment();
    const address = await prizePool.getAddress();

    console.log("✅ PrizePool deployed to:", address);
    console.log("");
    console.log("Add to your .env:");
    console.log(`VITE_PRIZE_POOL_ADDRESS=${address}`);
    console.log("");
    console.log("Verify on Basescan:");
    console.log(`npx hardhat verify --network baseMainnet ${address} "${USDC_ADDRESS}" "${TRUSTED_SIGNER}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
