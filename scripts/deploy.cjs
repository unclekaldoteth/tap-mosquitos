const hre = require("hardhat");

async function main() {
    console.log("Deploying MosquitoSlayerNFT to", hre.network.name, "...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    let trustedSigner =
        process.env.SIGNER_ADDRESS ||
        process.env.TRUSTED_SIGNER ||
        null;

    if (!trustedSigner && process.env.SIGNER_PRIVATE_KEY) {
        trustedSigner = new hre.ethers.Wallet(process.env.SIGNER_PRIVATE_KEY).address;
    }

    if (!trustedSigner) {
        trustedSigner = deployer.address;
    }

    console.log("Trusted signer:", trustedSigner);

    // Deploy contract
    const MosquitoSlayerNFT = await hre.ethers.getContractFactory("MosquitoSlayerNFT");
    const nft = await MosquitoSlayerNFT.deploy(trustedSigner);

    await nft.waitForDeployment();

    const address = await nft.getAddress();
    console.log("✅ MosquitoSlayerNFT deployed to:", address);
    console.log("\n📝 Update contract.js with this address!");

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

    console.log("\n🎮 Deployment complete!");
    console.log("Contract address:", address);
    const explorerBase = hre.network.name === "baseMainnet"
        ? "https://basescan.org"
        : "https://sepolia.basescan.org";
    console.log("Basescan:", `${explorerBase}/address/${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
