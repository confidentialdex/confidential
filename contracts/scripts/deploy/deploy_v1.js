import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { PAIRS_CONFIG, DEFAULT_MAX_POSITION_PCT, NETWORKS } from '../config/pairs_config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ══════════════════════════════════════════════════════════════
//  Configuration
// ══════════════════════════════════════════════════════════════

const NETWORK = NETWORKS.ARC_TESTNET; // Switch to ARC_MAINNET for production

// Helper to load artifacts compiled by Hardhat/Foundry
const loadArtifact = (name, parentFile = name) => {
    const p = path.join(__dirname, `../../artifacts/src/${parentFile}.sol/${name}.json`);
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
};

// Retry logic to handle rate limits
async function withRetry(operation, label = '', maxRetries = 5, baseDelayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            const msg = error.message?.substring(0, 80) || 'Unknown error';
            console.log(`  ⚠️ [Attempt ${attempt}/${maxRetries}] ${label}: ${msg} — retrying in ${baseDelayMs}ms...`);
            await new Promise(r => setTimeout(r, baseDelayMs));
            baseDelayMs *= 2;
        }
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════
//  Main Deployment
// ══════════════════════════════════════════════════════════════

async function main() {
    // ── Validate Environment ──
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY not found in .env file!");
        console.error("   Create a .env file with: PRIVATE_KEY=0xYOUR_KEY");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(
        process.env.ARC_TESTNET_URL || NETWORK.rpcUrl,
        NETWORK.chainId,
        { staticNetwork: true }
    );
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("═══════════════════════════════════════════");
    console.log("🚀 CONFIDENTIAL DEX — V1 FULL DEPLOYMENT");
    console.log("═══════════════════════════════════════════");
    console.log(`Network:  ${NETWORK.name} (Chain ${NETWORK.chainId})`);
    console.log(`Deployer: ${wallet.address}`);
    console.log(`Balance:  ${ethers.formatEther(await provider.getBalance(wallet.address))} ARC`);
    console.log(`Pairs:    ${PAIRS_CONFIG.length} trading pairs configured`);
    console.log("═══════════════════════════════════════════\n");

    const ProxyArtifact = loadArtifact("DEXProxy");

    // ──────────────────────────────────────────
    //  PHASE 1: Deploy Contracts
    // ──────────────────────────────────────────

    async function deployProxy(contractName, initArgs) {
        console.log(`\n📦 Deploying ${contractName}...`);
        const Artifact = loadArtifact(contractName);
        const Factory = new ethers.ContractFactory(Artifact.abi, Artifact.bytecode, wallet);
        
        // 1. Deploy Implementation
        const impl = await withRetry(async () => {
            const tx = await Factory.deploy();
            await tx.waitForDeployment();
            return tx;
        }, `${contractName} impl`);
        const implAddress = await impl.getAddress();
        console.log(`   Implementation: ${implAddress}`);

        // 2. Encode Init Data
        const iface = new ethers.Interface(Artifact.abi);
        const initData = iface.encodeFunctionData("initialize", initArgs);

        // 3. Deploy Proxy
        const ProxyFactory = new ethers.ContractFactory(ProxyArtifact.abi, ProxyArtifact.bytecode, wallet);
        const proxy = await withRetry(async () => {
            const tx = await ProxyFactory.deploy(implAddress, wallet.address, initData);
            await tx.waitForDeployment();
            return tx;
        }, `${contractName} proxy`);
        const proxyAddress = await proxy.getAddress();
        console.log(`   ✅ Proxy: ${proxyAddress}`);
        
        return new ethers.Contract(proxyAddress, Artifact.abi, wallet);
    }

    console.log("──────────────────────────────────────────");
    console.log("PHASE 1: Deploying Smart Contracts");
    console.log("──────────────────────────────────────────");

    // 1. Deploy PythPriceOracle
    const oracle = await deployProxy("PythPriceOracle", [NETWORK.pythAddress]);
    const oracleAddress = await oracle.getAddress();

    // 2. Deploy ConfidentialCoreV1
    const core = await deployProxy("ConfidentialCoreV1", [NETWORK.usdcAddress, oracleAddress]);
    const coreAddress = await core.getAddress();

    // 3. Deploy ConfidentialVaultV1 (pass deployer as dummy trading, will set later)
    const vault = await deployProxy("ConfidentialVaultV1", [NETWORK.usdcAddress, coreAddress, wallet.address]);
    const vaultAddress = await vault.getAddress();

    // 4. Deploy ConfidentialTradingV1
    const trading = await deployProxy("ConfidentialTradingV1", [NETWORK.usdcAddress, coreAddress, vaultAddress, oracleAddress]);
    const tradingAddress = await trading.getAddress();

    // ──────────────────────────────────────────
    //  PHASE 2: Link Protocol Modules
    // ──────────────────────────────────────────

    console.log("\n──────────────────────────────────────────");
    console.log("PHASE 2: Linking Protocol Modules");
    console.log("──────────────────────────────────────────");

    console.log("Setting Vault in Core...");
    await withRetry(() => core.setVault(vaultAddress).then(tx => tx.wait()), "setVault");

    console.log("Setting Trading in Core...");
    await withRetry(() => core.setTrading(tradingAddress).then(tx => tx.wait()), "setTrading");

    console.log("Setting Trading in Vault...");
    await withRetry(() => vault.setTrading(tradingAddress).then(tx => tx.wait()), "vault.setTrading");

    console.log("Setting Vault Cap...");
    // Default vault cap to 1,000,000 USDC
    const vaultCap = ethers.parseUnits("1000000", 6);
    await withRetry(() => vault.setMaxCapacity(vaultCap).then(tx => tx.wait()), "vault.setMaxCapacity");

    // ──────────────────────────────────────────
    //  PHASE 3: Set Treasury
    // ──────────────────────────────────────────

    console.log("\n──────────────────────────────────────────");
    console.log("PHASE 3: Setting Treasury");
    console.log("──────────────────────────────────────────");

    const treasuryAddress = process.env.TREASURY_ADDRESS || wallet.address;
    console.log(`Treasury: ${treasuryAddress}${treasuryAddress === wallet.address ? ' (deployer — update later via setTreasury)' : ''}`);
    await withRetry(() => core.setTreasury(treasuryAddress).then(tx => tx.wait()), "setTreasury");
    console.log("✅ Treasury set!");

    // ──────────────────────────────────────────
    //  PHASE 4: Register All Trading Pairs + Oracle Feeds
    // ──────────────────────────────────────────

    console.log("\n──────────────────────────────────────────");
    console.log(`PHASE 4: Registering ${PAIRS_CONFIG.length} Trading Pairs`);
    console.log("──────────────────────────────────────────");

    const pairIds = [];
    const feedIds = [];

    for (const pair of PAIRS_CONFIG) {
        const maxOI = ethers.parseUnits(pair.maxOI, 6);

        console.log(`  ${pair.name} — ${pair.maxLeverage}x, $${pair.maxOI} OI (Tier ${pair.tier})`);
        try {
            const tx = await core.addPair(
                pair.name,
                pair.pythFeedId,
                pair.maxLeverage,
                maxOI,           // maxLongOI
                maxOI,           // maxShortOI
                DEFAULT_MAX_POSITION_PCT
            );
            await tx.wait();

            // Collect for batch oracle registration
            pairIds.push(ethers.keccak256(ethers.toUtf8Bytes(pair.name)));
            feedIds.push(pair.pythFeedId);

            console.log(`  ✅ ${pair.name} added!`);
            await sleep(1500); // Rate limit protection
        } catch (e) {
            console.error(`  ❌ Failed: ${pair.name} — ${e.message?.substring(0, 80)}`);
        }
    }

    // ── Register Oracle Price Feeds (batch) ──
    console.log(`\n  🔗 Registering ${pairIds.length} Pyth Oracle feeds...`);
    try {
        const tx = await oracle.setPriceFeedsBatch(pairIds, feedIds);
        await tx.wait();
        console.log("  ✅ All Pyth Oracle feeds registered!");
    } catch (e) {
        console.error(`  ❌ Failed to register Oracle feeds: ${e.message?.substring(0, 80)}`);
        console.error("     Run setup_all_pairs.js manually to fix.");
    }

    // ──────────────────────────────────────────
    //  PHASE 5: Verify Deployment
    // ──────────────────────────────────────────

    console.log("\n──────────────────────────────────────────");
    console.log("PHASE 5: Verifying Deployment");
    console.log("──────────────────────────────────────────");

    // Verify BTC/USDC oracle feed
    const btcPairId = ethers.keccak256(ethers.toUtf8Bytes("BTC/USDC"));
    const btcFeedId = await oracle.priceFeedIds(btcPairId);
    const btcExpected = PAIRS_CONFIG[0].pythFeedId;
    const oracleOk = btcFeedId.toLowerCase() === btcExpected.toLowerCase();
    console.log(`Oracle BTC/USDC: ${oracleOk ? '✅' : '❌'} ${btcFeedId.substring(0, 18)}...`);

    // Verify BTC/USDC leverage in Core
    const btcConfig = await core.getPairConfig(btcPairId);
    const leverageOk = Number(btcConfig.maxLeverage) === 100;
    console.log(`Core BTC/USDC leverage: ${leverageOk ? '✅' : '❌'} ${btcConfig.maxLeverage}x`);

    // Verify pair count
    const pairCount = await core.getPairCount();
    console.log(`Total pairs registered: ${Number(pairCount) === PAIRS_CONFIG.length ? '✅' : '⚠️'} ${pairCount}`);

    // Verify module links
    const coreVault = await core.vault();
    const coreTrading = await core.trading();
    console.log(`Core→Vault link:   ${coreVault === vaultAddress ? '✅' : '❌'}`);
    console.log(`Core→Trading link: ${coreTrading === tradingAddress ? '✅' : '❌'}`);

    if (!oracleOk || !leverageOk) {
        console.log("\n⚠️  Some verifications failed! Review the output above.");
    }

    // ──────────────────────────────────────────
    //  PHASE 6: Save Deployment Data
    // ──────────────────────────────────────────

    console.log("\n──────────────────────────────────────────");
    console.log("PHASE 6: Saving Deployment Data");
    console.log("──────────────────────────────────────────");

    const output = {
        version: "V1",
        timestamp: new Date().toISOString(),
        network: NETWORK.name,
        chainId: NETWORK.chainId,
        deployer: wallet.address,
        treasury: treasuryAddress,
        usdcAddress: NETWORK.usdcAddress,
        pythAddress: NETWORK.pythAddress,
        oracleAddress,
        coreAddress,
        vaultAddress,
        tradingAddress,
        pairsCount: PAIRS_CONFIG.length,
    };

    const outDir = path.join(__dirname, "../../deployments");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, "v1.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`\n💾 Deployment data saved to: ${outPath}`);

    console.log("\n═══════════════════════════════════════════");
    console.log("🎉 V1 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════");
    console.log(`Oracle:  ${oracleAddress}`);
    console.log(`Core:    ${coreAddress}`);
    console.log(`Vault:   ${vaultAddress}`);
    console.log(`Trading: ${tradingAddress}`);
    console.log(`Pairs:   ${PAIRS_CONFIG.length} pairs with Oracle feeds`);
    console.log("═══════════════════════════════════════════");
    console.log("\n📋 Next steps:");
    console.log("  1. Update frontend src/config/contracts.ts with new addresses");
    console.log("  2. Update feederBot.cjs .env with new contract addresses");
    console.log("  3. Redeploy Goldsky subgraph with new addresses");
    console.log("  4. pm2 restart feederBot");
}

main().catch(e => {
    console.error("\n💀 DEPLOYMENT FAILED:", e.message);
    process.exit(1);
});
