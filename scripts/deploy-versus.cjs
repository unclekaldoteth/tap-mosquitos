const hre = require("hardhat");

async function main() {
    console.log("Deploying VersusNFT to", hre.network.name, "...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // Trusted signer for game result verification
    // Use SIGNER_ADDRESS from env, or default to deployer address
    const trustedSigner = process.env.SIGNER_ADDRESS || deployer.address;
    console.log("Trusted Signer:", trustedSigner);

    // Deploy contract
    const VersusNFT = await hre.ethers.getContractFactory("VersusNFT");
    const nft = await VersusNFT.deploy(trustedSigner);

    await nft.waitForDeployment();

    const address = await nft.getAddress();
    console.log("✅ VersusNFT deployed to:", address);
    console.log("\n📝 Update versusContract.js with this address!");

    // Wait for a few block confirmations before verification
    console.log("\nWaiting for block confirmations...");
    await nft.deploymentTransaction().wait(5);

    // Try to verify on Basescan
    if (process.env.BASESCAN_API_KEY) {
        console.log("\nVerifying contract on Basescan...");
        try {
            await hre.run("verify:verify", {
                address: address,
                constructorArguments: [trustedSigner],
            });
            console.log("✅ Contract verified!");
        } catch (error) {
            console.log("Verification failed:", error.message);
        }
    }

    console.log("\n🎮 VersusNFT Deployment complete!");
    console.log("Contract address:", address);
    console.log("Basescan:", `https://sepolia.basescan.org/address/${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
