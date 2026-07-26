import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadArtifact(contractName) {
    const p = path.resolve(__dirname, `../../artifacts/src/${contractName}.sol/${contractName}.json`);
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
    const provider = new ethers.JsonRpcProvider('https://rpc.drpc.testnet.arc.network');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log("Compiling contracts...");
    // Assuming already compiled, if not they will be compiled by user running npx hardhat compile

    const CoreArtifact = loadArtifact("ConfidentialCoreV1");
    const Factory = new ethers.ContractFactory(CoreArtifact.abi, CoreArtifact.bytecode, wallet);
    
    console.log("1. Deploying new ConfidentialCoreV1 logic...");
    const impl = await Factory.deploy();
    await impl.waitForDeployment();
    const implAddress = await impl.getAddress();
    console.log(`   New Logic Address: ${implAddress}`);

    console.log("2. Upgrading Proxy via ProxyAdmin...");
    const coreProxy = "0x9acec9Ad24870f95927224FfC5E1c94274492cd8";
    const adminAddress = "0x3b20139273BF3e0B30f8d85F9a25E322f00eDc56"; // Found via ERC1967 ADMIN_SLOT
    
    // ProxyAdmin ABI from OpenZeppelin
    const proxyAdminAbi = [
        "function upgradeAndCall(address proxy, address implementation, bytes memory data) payable",
        "function upgrade(address proxy, address implementation)"
    ];
    
    const admin = new ethers.Contract(adminAddress, proxyAdminAbi, wallet);
    
    // TransparentUpgradeableProxy in OZ v5 uses upgradeAndCall on the proxy admin.
    const tx = await admin.upgradeAndCall(coreProxy, implAddress, "0x");
    console.log(`   Tx hash: ${tx.hash}`);
    await tx.wait();
    
    console.log("✅ Upgrade Successful! Proxy now points to new Logic.");
}

main().catch(console.error);
