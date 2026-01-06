// api/sign-achievement.js
// Serverless function for signing NFT achievement mints
// This endpoint verifies the score and returns a signature for minting

import { ethers } from 'ethers';

// CORS headers for Vercel
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    // Only accept POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { playerAddress, tier, score, nonce } = req.body;

        // Validate inputs
        if (!playerAddress || tier === undefined || score === undefined || nonce === undefined) {
            return res.status(400).json({
                error: 'Missing required fields: playerAddress, tier, score, nonce'
            });
        }

        // Validate tier (0-4)
        if (tier < 0 || tier > 4) {
            return res.status(400).json({ error: 'Invalid tier (must be 0-4)' });
        }

        // Validate score meets tier requirement
        const tierThresholds = [0, 200, 500, 1000, 2000]; // Common, Uncommon, Rare, Epic, Legendary
        if (score < tierThresholds[tier]) {
            return res.status(400).json({
                error: `Score ${score} does not qualify for tier ${tier} (needs ${tierThresholds[tier]})`
            });
        }

        // Get signer private key from environment
        const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
        if (!signerPrivateKey) {
            console.error('SIGNER_PRIVATE_KEY not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Create signer
        const signer = new ethers.Wallet(signerPrivateKey);

        // Create message hash exactly as the contract expects
        // keccak256(abi.encodePacked(msg.sender, tier, score, nonce))
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint8', 'uint256', 'uint256'],
            [playerAddress, tier, score, nonce]
        );

        // Sign the message (this creates an EIP-191 signed message)
        const signature = await signer.signMessage(ethers.getBytes(messageHash));

        console.log(`Signed achievement: player=${playerAddress}, tier=${tier}, score=${score}, nonce=${nonce}`);

        return res.status(200).json({
            success: true,
            signature,
            messageHash,
            signer: signer.address
        });

    } catch (error) {
        console.error('Sign achievement error:', error);
        return res.status(500).json({
            error: 'Failed to sign achievement',
            details: error.message
        });
    }
}
