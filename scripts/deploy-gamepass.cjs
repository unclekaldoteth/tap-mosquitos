/**
 * Deploy GamePassNFT contract
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-gamepass.cjs --network baseSepolia
 *   npx hardhat run scripts/deploy-gamepass.cjs --network baseMainnet
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying GamePassNFT with account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    // Get signer address from env
    const signerAddress = process.env.SIGNER_ADDRESS || deployer.address;
    console.log("Trusted signer:", signerAddress);

    // Deploy GamePassNFT
    const GamePassNFT = await hre.ethers.getContractFactory("GamePassNFT");
    const gamePass = await GamePassNFT.deploy(signerAddress);
    await gamePass.waitForDeployment();

    const address = await gamePass.getAddress();
    console.log("GamePassNFT deployed to:", address);
    console.log("Mint price:", "0.0005 ETH");
    console.log("Revenue split: 70% prize pool, 20% treasury, 10% referral");

    // Wait for confirmations
    console.log("Waiting for confirmations...");
    await gamePass.deploymentTransaction().wait(5);

    // Verify on Basescan
    if (process.env.BASESCAN_API_KEY) {
        console.log("Verifying contract on Basescan...");
        try {
            await hre.run("verify:verify", {
                address: address,
                constructorArguments: [signerAddress],
            });
            console.log("Contract verified on Basescan");
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log("Contract already verified");
            } else {
                console.error("Verification failed:", error.message);
            }
        }
    }

    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log("Contract Address:", address);
    console.log("\nAdd to .env:");
    console.log(`VITE_GAMEPASS_CONTRACT_ADDRESS=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
