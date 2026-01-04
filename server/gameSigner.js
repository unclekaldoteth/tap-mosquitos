/**
 * Backend Game Result Signer
 * 
 * This module provides functions to sign game results for smart contract verification.
 * The signer wallet does NOT need to be funded - it only signs messages off-chain.
 * 
 * Usage:
 * 1. Generate a wallet: node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"
 * 2. Add to .env: SIGNER_PRIVATE_KEY=0x...
 * 3. Deploy contracts with the signer's public address as trustedSigner
 * 4. Use these functions to sign game results before players submit to contract
 */

import { ethers } from 'ethers';

// Initialize signer from environment variable
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY;

if (!SIGNER_PRIVATE_KEY) {
    console.warn('⚠️  SIGNER_PRIVATE_KEY not set in environment');
}

const signer = SIGNER_PRIVATE_KEY ? new ethers.Wallet(SIGNER_PRIVATE_KEY) : null;

/**
 * Get the signer's public address (use this when deploying contracts)
 */
export function getSignerAddress() {
    if (!signer) throw new Error('Signer not configured');
    return signer.address;
}

/**
 * Sign a VersusNFT battle result
 * @param challengeId - The challenge ID
 * @param winnerScore - Winner's score
 * @param loserScore - Loser's score
 * @param winnerIsChallenger - True if challenger won
 * @returns Signature string to pass to finalizeBattle()
 */
export async function signBattleResult(challengeId, winnerScore, loserScore, winnerIsChallenger) {
    if (!signer) throw new Error('Signer not configured');

    const messageHash = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'uint256', 'bool'],
        [challengeId, winnerScore, loserScore, winnerIsChallenger]
    );

    return await signer.signMessage(ethers.getBytes(messageHash));
}

/**
 * Sign a MosquitoSlayerNFT achievement mint
 * @param playerAddress - The player's wallet address
 * @param tier - Achievement tier (0=Common, 1=Uncommon, 2=Rare, 3=Epic, 4=Legendary)
 * @param score - The score achieved
 * @param nonce - Unique nonce (use timestamp or random number)
 * @returns Signature string to pass to mintAchievement()
 */
export async function signAchievement(playerAddress, tier, score, nonce) {
    if (!signer) throw new Error('Signer not configured');

    const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint8', 'uint256', 'uint256'],
        [playerAddress, tier, score, nonce]
    );

    return await signer.signMessage(ethers.getBytes(messageHash));
}

/**
 * Generate a unique nonce for achievement signing
 */
export function generateNonce() {
    return Date.now();
}

// Export signer address for convenience
export const signerAddress = signer?.address || null;
