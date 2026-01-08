// scripts/update-nft-signer.cjs
// Update MosquitoSlayerNFT trusted signer without redeploying

const hre = require("hardhat");

async function main() {
    console.log("Updating MosquitoSlayerNFT trusted signer...\n");

    const contractAddress =
        process.env.NFT_CONTRACT_ADDRESS ||
        process.env.VITE_NFT_CONTRACT_ADDRESS;

    if (!contractAddress) {
        throw new Error("Missing NFT_CONTRACT_ADDRESS or VITE_NFT_CONTRACT_ADDRESS");
    }

    let newSigner =
        process.env.NEW_TRUSTED_SIGNER ||
        process.env.SIGNER_ADDRESS ||
        null;

    if (!newSigner && process.env.SIGNER_PRIVATE_KEY) {
        newSigner = new hre.ethers.Wallet(process.env.SIGNER_PRIVATE_KEY).address;
    }

    if (!newSigner) {
        throw new Error("Missing NEW_TRUSTED_SIGNER, SIGNER_ADDRESS, or SIGNER_PRIVATE_KEY");
    }

    if (newSigner === hre.ethers.ZeroAddress) {
        throw new Error("Invalid signer address");
    }

    const [deployer] = await hre.ethers.getSigners();
    console.log("Using account:", deployer.address);
    console.log("Contract:", contractAddress);
    console.log("New trusted signer:", newSigner);

    const nft = await hre.ethers.getContractAt("MosquitoSlayerNFT", contractAddress);
    const tx = await nft.setTrustedSigner(newSigner);
    console.log("Tx sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Trusted signer updated in block:", receipt.blockNumber);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
