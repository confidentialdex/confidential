import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

// Helper to load artifacts compiled by Hardhat
const loadArtifact = (name, parentFile = name) => {
    const p = path.join(__dirname, `../../artifacts/src/${parentFile}.sol/${name}.json`);
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
};

// Retry logic to handle rate limits
async function withRetry(operation, maxRetries = 5, baseDelayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            console.log(`[Attempt ${attempt} failed] ${error.message.substring(0, 50)}... Retrying in ${baseDelayMs}ms...`);
            await new Promise(r => setTimeout(r, baseDelayMs));
            baseDelayMs *= 2; // Exponential backoff
        }
    }
}

async function main() {
    const PYTH_ADDRESS = "0x2880aB155794e7179c9eE2e38200202908C17B43"; // Pyth on Arc Testnet
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

    const rpcUrl = process.env.ARC_TESTNET_URL || "https://rpc.drpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("=========================================");
    console.log("🚀 STARTING V1 DEPLOYMENT ON ARC TESTNET");
    console.log("=========================================");
    console.log("Deployer:", wallet.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ARC");

    const ProxyArtifact = loadArtifact("DEXProxy");

    // Reusable deploy proxy function
    async function deployProxy(contractName, initArgs) {
        console.log(`\nDeploying ${contractName}...`);
        const Artifact = loadArtifact(contractName);
        const Factory = new ethers.ContractFactory(Artifact.abi, Artifact.bytecode, wallet);
        
        // 1. Deploy Implementation
        const impl = await withRetry(async () => {
            const tx = await Factory.deploy();
            await tx.waitForDeployment();
            return tx;
        });
        const implAddress = await impl.getAddress();
        console.log(`- Implementation: ${implAddress}`);

        // 2. Encode Init Data
        const iface = new ethers.Interface(Artifact.abi);
        const initData = iface.encodeFunctionData("initialize", initArgs);

        // 3. Deploy Proxy
        const ProxyFactory = new ethers.ContractFactory(ProxyArtifact.abi, ProxyArtifact.bytecode, wallet);
        const proxy = await withRetry(async () => {
            // In OZ v5, ProxyAdmin is deployed automatically inside the constructor if deployer is the owner
            const tx = await ProxyFactory.deploy(implAddress, wallet.address, initData);
            await tx.waitForDeployment();
            return tx;
        });
        const proxyAddress = await proxy.getAddress();
        console.log(`✅ ${contractName} Proxy: ${proxyAddress}`);
        
        return new ethers.Contract(proxyAddress, Artifact.abi, wallet);
    }

    // 1. Deploy PythPriceOracle
    const oracle = await deployProxy("PythPriceOracle", [PYTH_ADDRESS]);
    const oracleAddress = await oracle.getAddress();

    // 2. Deploy ConfidentialCoreV1
    const core = await deployProxy("ConfidentialCoreV1", [USDC_ADDRESS, oracleAddress]);
    const coreAddress = await core.getAddress();

    // 3. Deploy ConfidentialVaultV1 (pass deployer as dummy trading, will set later)
    const vault = await deployProxy("ConfidentialVaultV1", [USDC_ADDRESS, coreAddress, wallet.address]);
    const vaultAddress = await vault.getAddress();

    // 4. Deploy ConfidentialTradingV1
    const trading = await deployProxy("ConfidentialTradingV1", [USDC_ADDRESS, coreAddress, vaultAddress, oracleAddress]);
    const tradingAddress = await trading.getAddress();

    console.log("\n=========================================");
    console.log("⚙️  CONFIGURING PROTOCOL MODULES");
    console.log("=========================================");

    // Link Core -> Vault & Trading
    console.log("Setting Vault in Core...");
    await withRetry(() => core.setVault(vaultAddress).then(tx => tx.wait()));
    console.log("Setting Trading in Core...");
    await withRetry(() => core.setTrading(tradingAddress).then(tx => tx.wait()));

    // Link Vault -> Trading
    console.log("Setting Trading in Vault...");
    await withRetry(() => vault.setTrading(tradingAddress).then(tx => tx.wait()));

    console.log("\n=========================================");
    console.log("📈 SETTING UP TRADING PAIRS");
    console.log("=========================================");

    const BTC_PRICE_FEED = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
    const ETH_PRICE_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

    console.log("Adding BTC/USDC...");
    await withRetry(() => core.addPair("BTC/USDC", BTC_PRICE_FEED, 50, 1000000000, 1000000000, 500000000).then(tx => tx.wait()));
    
    console.log("Adding ETH/USDC...");
    await withRetry(() => core.addPair("ETH/USDC", ETH_PRICE_FEED, 50, 1000000000, 1000000000, 500000000).then(tx => tx.wait()));

    console.log("\n=========================================");
    console.log("💾 SAVING DEPLOYMENT DATA");
    console.log("=========================================");

    const output = {
        version: "V1",
        timestamp: new Date().toISOString(),
        network: "Arc Testnet",
        deployer: wallet.address,
        usdcAddress: USDC_ADDRESS,
        pythAddress: PYTH_ADDRESS,
        oracleAddress: oracleAddress,
        coreAddress: coreAddress,
        vaultAddress: vaultAddress,
        tradingAddress: tradingAddress
    };

    const outDir = path.join(__dirname, "../../deployments");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    
    const outPath = path.join(outDir, "v1.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    
    console.log(`✅ Deployment data saved to: ${outPath}`);
    console.log("\n🎉 V1 DEPLOYMENT SUCCESSFUL!");
}

main().catch(console.error);
