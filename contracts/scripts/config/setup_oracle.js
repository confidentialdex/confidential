import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PAIRS_CONFIG } from './pairs_config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const RPC_URL = 'https://rpc.testnet.arc.io';
const ORACLE_ADDRESS = '0x7e8f460ebBAE6A767bC80561c322e3c589a8A3C7';
const ORACLE_ABI = [
    'function getPriceId(bytes32 pairId) view returns (bytes32)',
    'function setPriceFeed(bytes32 pairId, bytes32 pythFeedId) external',
    'function owner() view returns (address)'
];

async function main() {
    console.log("=== Setting Up PythPriceOracle Pairs ===");
    
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY not found in .env file!");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, wallet);

    console.log(`Connected wallet: ${wallet.address}`);
    
    let isOwner = true;
    try {
        const ownerAddr = await oracle.owner();
        if (ownerAddr.toLowerCase() !== wallet.address.toLowerCase()) {
            console.error(`❌ Connected wallet is NOT the Oracle owner! Owner is ${ownerAddr}`);
            isOwner = false;
            // We can still try to continue but it will likely fail
        }
    } catch (e) {
        console.error("Failed to fetch owner:", e.message);
    }

    for (const pair of PAIRS_CONFIG) {
        const pairId = ethers.keccak256(ethers.toUtf8Bytes(pair.name));
        let registeredId;
        
        try {
            registeredId = await oracle.getPriceId(pairId);
        } catch (e) {
            registeredId = null; // Reverts if not set
        }

        const targetPythId = pair.pythFeedId.startsWith('0x') ? pair.pythFeedId : '0x' + pair.pythFeedId;

        if (registeredId === targetPythId) {
            console.log(`✅ [${pair.name}] Already configured with ${targetPythId}`);
            continue;
        }

        console.log(`⏳ [${pair.name}] Configuring Pyth ID...`);
        try {
            const tx = await oracle.setPriceFeed(pairId, targetPythId);
            console.log(`   Tx Hash: ${tx.hash}`);
            await tx.wait(1);
            console.log(`   Successfully configured!`);
        } catch (e) {
            console.error(`❌ Failed to configure ${pair.name}:`, e.shortMessage || e.message);
        }
    }
    
    console.log("=== Configuration Complete ===");
}

main().catch(console.error);
