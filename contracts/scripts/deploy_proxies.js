import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(operation, maxRetries = 15, initialDelay = 120000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await operation();
        } catch (error) {
            console.error(`\n⚠️  Error: ${error.message}`);
            if (error.message.includes('request limit reached') || error.message.includes('429')) {
                retries++;
                console.log(`⏳ Rate limited. Waiting 2 minutes (120s) to let the RPC rate limit window cool down... (Attempt ${retries}/${maxRetries})`);
                await delay(initialDelay);
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached');
}

async function main() {
    console.log("🚀 Starting Manual Proxy Deployment of Confidential DEX V1 on ARC Testnet");
    console.log("═══════════════════════════════════════════════════════");

    if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY.length < 64) {
      console.error("❌ ERROR: Invalid PRIVATE_KEY in .env file!");
      process.exitCode = 1;
      return;
    }

    const rpcUrl = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: 5042002, name: 'arc' }, { staticNetwork: true });
    const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`Deploying from account: ${deployer.address}`);
    
    const balance = await provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ARC`);

    const usdcAddress = '0x3600000000000000000000000000000000000000';
    const pythContractAddress = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729'; 

    const loadArtifact = (name, parentFile = name) => {
        const raw = fs.readFileSync(path.join(__dirname, `../artifacts/src/${parentFile}.sol/${name}.json`));
        return JSON.parse(raw);
    };

    const getFactory = (name, parentFile = name) => {
        const artifact = loadArtifact(name, parentFile);
        return new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    };

    const ProxyAdminFactory = getFactory("DEXProxyAdmin", "DEXProxy");
    const ProxyFactory = getFactory("DEXProxy", "DEXProxy");

    // Deploy ProxyAdmin
    console.log("\n0️⃣  Deploying DEXProxyAdmin...");
    const proxyAdmin = await withRetry(async () => {
        const tx = await ProxyAdminFactory.deploy(deployer.address);
        await tx.waitForDeployment();
        return tx;
    });
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log(`✅ ProxyAdmin deployed to: ${proxyAdminAddress}`);

    async function deployProxy(contractName, initArgs) {
        await delay(3000);
        console.log(`\nDeploying ${contractName}...`);
        
        const ImplFactory = getFactory(contractName);
        
        const impl = await withRetry(async () => {
            const tx = await ImplFactory.deploy();
            await tx.waitForDeployment();
            return tx;
        });
        const implAddress = await impl.getAddress();
        console.log(`   Implementation deployed to: ${implAddress}`);

        const initData = ImplFactory.interface.encodeFunctionData("initialize", initArgs);
        
        await delay(3000);
        const proxy = await withRetry(async () => {
            const tx = await ProxyFactory.deploy(implAddress, proxyAdminAddress, initData);
            await tx.waitForDeployment();
            return tx;
        });
        const proxyAddress = await proxy.getAddress();
        console.log(`   ✅ Proxy deployed to: ${proxyAddress}`);
        
        return new ethers.Contract(proxyAddress, ImplFactory.interface, deployer);
    }

    // 1. Deploy Oracle
    const oracle = await deployProxy("PythPriceOracle", [pythContractAddress]);
    const oracleAddress = await oracle.getAddress();

    // 2. Deploy Core
    const core = await deployProxy("ConfidentialCoreV1", [usdcAddress, oracleAddress]);
    const coreAddress = await core.getAddress();

    // 3. Deploy Vault (Pass dummy trading address to break circular dependency)
    const vault = await deployProxy("ConfidentialVaultV1", [usdcAddress, coreAddress, deployer.address]);
    const vaultAddress = await vault.getAddress();

    // 4. Deploy Trading
    const trading = await deployProxy("ConfidentialTradingV1", [usdcAddress, coreAddress, vaultAddress, oracleAddress]);
    const tradingAddress = await trading.getAddress();

    // 5. Link them
    console.log("\n5️⃣  Linking Core ↔ Vault ↔ Trading...");
    
    await delay(3000);
    await withRetry(async () => {
        const tx = await vault.setTrading(tradingAddress);
        await tx.wait();
    });
    console.log("   ✅ Vault → Trading linked");

    await delay(3000);
    await withRetry(async () => {
        const tx = await core.setVault(vaultAddress);
        await tx.wait();
    });
    console.log("   ✅ Core → Vault linked");

    await delay(3000);
    await withRetry(async () => {
        const tx = await core.setTrading(tradingAddress);
        await tx.wait();
    });
    console.log("   ✅ Core → Trading linked");

    await delay(3000);
    await withRetry(async () => {
        const tx = await core.setTreasury(deployer.address);
        await tx.wait();
    });
    console.log("   ✅ Core → Treasury linked (deployer)");

    await delay(3000);
    await withRetry(async () => {
        const tx = await core.setKeeper(deployer.address);
        await tx.wait();
    });
    console.log("   ✅ Core → Keeper registered (deployer)");

    const deployInfo = {
      version: "V1_PROXY",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      proxyAdminAddress,
      coreAddress,
      vaultAddress,
      tradingAddress,
      oracleAddress,
      usdcAddress
    };
    
    fs.writeFileSync(path.join(__dirname, 'latest_deploy_proxies.json'), JSON.stringify(deployInfo, null, 2));

    console.log("\n🎉 DEPLOYMENT V1 (PROXY) COMPLETE!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
