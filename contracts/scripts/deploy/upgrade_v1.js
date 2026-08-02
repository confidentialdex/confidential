import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { NETWORKS } from '../config/pairs_config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const NETWORK = NETWORKS.ARC_TESTNET; 

const loadArtifact = (name, parentFile = name) => {
    const p = path.join(__dirname, `../../artifacts/src/${parentFile}.sol/${name}.json`);
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
};

const getProxyAdmin = async (provider, proxyAddress) => {
    // ERC1967 Admin slot
    const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    let admin = await provider.getStorage(proxyAddress, adminSlot);
    admin = ethers.dataSlice(admin, 12); // address is 20 bytes, get last 20 bytes of 32 byte slot
    return ethers.getAddress(admin);
};

async function main() {
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ PRIVATE_KEY not found in .env file!");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(
        process.env.ARC_TESTNET_URL || NETWORK.rpcUrl,
        NETWORK.chainId,
        { staticNetwork: true }
    );
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("═══════════════════════════════════════════");
    console.log("🚀 UPGRADING CONFIDENTIAL DEX CONTRACTS");
    console.log("═══════════════════════════════════════════");

    const outPath = path.join(__dirname, "../../deployments/v1.json");
    if (!fs.existsSync(outPath)) {
        throw new Error("v1.json not found!");
    }
    const deployments = JSON.parse(fs.readFileSync(outPath, 'utf-8'));

    const ProxyAdminAbi = [
        "function upgradeAndCall(address proxy, address implementation, bytes data) payable"
    ];

    async function upgradeContract(name, proxyAddress) {
        console.log(`\n⬆️ Upgrading ${name} at ${proxyAddress}...`);
        
        const Artifact = loadArtifact(name);
        const Factory = new ethers.ContractFactory(Artifact.abi, Artifact.bytecode, wallet);
        
        console.log(`   Deploying new logic...`);
        const impl = await Factory.deploy();
        await impl.waitForDeployment();
        const implAddress = await impl.getAddress();
        console.log(`   New Logic: ${implAddress}`);

        const adminAddress = await getProxyAdmin(provider, proxyAddress);
        console.log(`   ProxyAdmin: ${adminAddress}`);

        const adminContract = new ethers.Contract(adminAddress, ProxyAdminAbi, wallet);
        console.log(`   Executing upgrade...`);
        const tx = await adminContract.upgradeAndCall(proxyAddress, implAddress, "0x");
        await tx.wait();
        console.log(`   ✅ Upgrade successful!`);
    }

    await upgradeContract("ConfidentialCoreV1", deployments.coreAddress);
    await upgradeContract("ConfidentialTradingV1", deployments.tradingAddress);

    console.log("\n═══════════════════════════════════════════");
    console.log("🎉 UPGRADE COMPLETE!");
    console.log("═══════════════════════════════════════════");
}

main().catch(e => {
    console.error("\n💀 UPGRADE FAILED:", e.message);
    process.exit(1);
});
