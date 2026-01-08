// scripts/deploy-prizepool-testnet.cjs
// Deploy PrizePool contract to Base Sepolia testnet

const hre = require("hardhat");

async function main() {
    console.log("Deploying PrizePool to Base Sepolia (Testnet)...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    if (balance === 0n) {
        console.log("⚠️  No ETH! Get testnet ETH from: https://www.alchemy.com/faucets/base-sepolia");
        process.exit(1);
    }

    // USDC on Base Sepolia (Circle's testnet USDC)
    // If this doesn't exist, you can deploy a mock ERC20 or use any ERC20 token
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

    // Trusted signer (env override or deployer)
    const TRUSTED_SIGNER = process.env.SIGNER_ADDRESS || deployer.address;

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
    console.log("Add to your .env for testnet:");
    console.log(`VITE_PRIZE_POOL_ADDRESS=${address}`);
    console.log("");
    console.log("Verify on Basescan:");
    console.log(`npx hardhat verify --network baseSepolia ${address} "${USDC_ADDRESS}" "${TRUSTED_SIGNER}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
